import ObjC from "frida-objc-bridge";

// The in-game menu and keybinds.
//
// The menu is a rounded, shadowed window attached to the game's window (so it follows it, fullscreen
// included) showing the menu page in a WKWebView. Keybinds come from one local key monitor: it only
// runs when a key is pressed, never per frame. All AppKit work happens on the main queue.

type Log = (message: string) => void;

export interface KeyBinding {
    code: number; // macOS virtual key code
    label: string; // what to show, e.g. "⇧F"
    mods: number; // NSEventModifierFlags subset: shift/control/option/command
}

const NS_KEY_DOWN_MASK = 1 << 10;
const KEY_ESCAPE = 53;
const MOD_MASK = (1 << 17) | (1 << 18) | (1 << 19) | (1 << 20);
const MOD_SYMBOLS: [number, string][] = [
    [1 << 18, "⌃"],
    [1 << 19, "⌥"],
    [1 << 17, "⇧"],
    [1 << 20, "⌘"],
];

export const DEFAULT_MENU_KEY: KeyBinding = { code: 50, label: "`", mods: 0 };

let bindings: Record<string, KeyBinding> = { menu: DEFAULT_MENU_KEY };
let listeningFor: string | null = null;
let onBindingsChanged: (b: Record<string, KeyBinding>) => void = () => {};
let onAction: (action: string) => void = () => {};
let url = "";
let log: Log = () => {};
let size = { width: 0.72, height: 0.8 }; // of the game window

let win: ObjC.Object | null = null;
let web: ObjC.Object | null = null;
let gameWindow: ObjC.Object | null = null;
const keep: unknown[] = []; // blocks and objects that must outlive this call

export interface OverlayOptions {
    url: string;
    bindings: Record<string, KeyBinding>;
    size?: { width: number; height: number };
    onBindingsChanged: (b: Record<string, KeyBinding>) => void;
    onAction: (action: string) => void;
    log: Log;
}

export function startOverlay(o: OverlayOptions): void {
    log = o.log;
    url = o.url;
    bindings = { menu: DEFAULT_MENU_KEY, ...o.bindings };
    if (o.size) size = o.size;
    onBindingsChanged = o.onBindingsChanged;
    onAction = o.onAction;
    if (!ObjC.available) return log("Overlay: no Objective-C runtime, in-game menu disabled (the browser menu still works)");
    try {
        Module.load("/System/Library/Frameworks/WebKit.framework/WebKit");
    } catch (e) {
        return log(`Overlay: couldn't load WebKit (${e}); in-game menu disabled`);
    }
    ObjC.schedule(ObjC.mainQueue, () => {
        try {
            installKeyMonitor();
            log(`Overlay: press ${bindings.menu.label} in the game to open the menu`);
        } catch (e) {
            log(`Overlay: key monitor failed: ${(e as Error).stack ?? e}`);
        }
    });
}

// ── keybinds ────────────────────────────────────────────────────────────────────────────

/** The next key pressed in the game becomes `action`'s key. Esc cancels; Backspace clears it. */
export function listenForKey(action: string): void {
    listeningFor = action;
}

export function clearKey(action: string): void {
    if (action === "menu") return; // the menu always needs a key
    delete bindings[action];
    onBindingsChanged({ ...bindings });
}

export function keyState() {
    return { bindings: { ...bindings }, listeningFor };
}

function labelFor(ev: ObjC.Object, code: number, mods: number): string {
    const named: Record<number, string> = { 48: "Tab", 49: "Space", 36: "Return", 51: "Delete", 53: "Esc", 123: "←", 124: "→", 125: "↓", 126: "↑", 122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5", 97: "F6", 98: "F7", 100: "F8", 101: "F9", 109: "F10", 103: "F11", 111: "F12" };
    const chars = ev.charactersIgnoringModifiers();
    const key = named[code] ?? (chars ? chars.toString().toUpperCase().trim() : "") ?? `key ${code}`;
    return MOD_SYMBOLS.filter(([bit]) => mods & bit).map(([, s]) => s).join("") + (key || `key ${code}`);
}

function installKeyMonitor(): void {
    const handler = new ObjC.Block({
        retType: "pointer",
        argTypes: ["pointer"],
        implementation(event: NativePointer): NativePointer {
            try {
                const ev = new ObjC.Object(event);
                const code = ev.keyCode() as number;
                const mods = (ev.modifierFlags() as number) & MOD_MASK;

                if (listeningFor) {
                    const action = listeningFor;
                    listeningFor = null;
                    if (code === KEY_ESCAPE) return NULL;
                    if (code === 51 && action !== "menu") {
                        clearKey(action);
                        return NULL;
                    }
                    bindings[action] = { code, mods, label: labelFor(ev, code, mods) };
                    onBindingsChanged({ ...bindings });
                    log(`Keybinds: ${action} → ${bindings[action].label}`);
                    return NULL;
                }

                const matches = (b?: KeyBinding) => !!b && b.code === code && (b.mods ?? 0) === mods;
                if (matches(bindings.menu) || (code === KEY_ESCAPE && isOpen())) {
                    toggle();
                    return NULL;
                }
                // Feature keybinds only fire in the game, not while typing in the menu.
                const evWindow = ev.window() as ObjC.Object | null;
                if (win && evWindow && !evWindow.handle.isNull() && evWindow.handle.equals(win.handle)) return event;
                for (const [action, b] of Object.entries(bindings)) {
                    if (action === "menu" || !matches(b)) continue;
                    Script.nextTick(() => onAction(action)); // run it on the agent thread, not in AppKit's
                    return NULL;
                }
            } catch (e) {
                log(`Overlay: key handler error: ${e}`);
            }
            return event;
        },
    });
    keep.push(handler);
    keep.push(ObjC.classes.NSEvent.addLocalMonitorForEventsMatchingMask_handler_(NS_KEY_DOWN_MASK, handler));
}

// ── window ──────────────────────────────────────────────────────────────────────────────

function isOpen(): boolean {
    return win !== null && (win.isVisible() as boolean);
}

export function overlayOpen(): boolean {
    return isOpen();
}

function findGameWindow(): ObjC.Object | null {
    const app = ObjC.classes.NSApplication.sharedApplication();
    const main = app.mainWindow() as ObjC.Object | null;
    if (main && !main.handle.isNull() && (!win || !main.handle.equals(win.handle))) return main;
    const windows = app.windows();
    for (let i = 0; i < (windows.count() as number); i++) {
        const w = windows.objectAtIndex_(i) as ObjC.Object;
        if (!win || !w.handle.equals(win.handle)) return w;
    }
    return null;
}

function frameFor(game: ObjC.Object): number[][] {
    const frame = game.frame() as [[number, number], [number, number]];
    const width = Math.max(560, Math.min(frame[1][0] - 24, Math.round(frame[1][0] * size.width)));
    const height = Math.max(420, Math.min(frame[1][1] - 24, Math.round(frame[1][1] * size.height)));
    return [
        [frame[0][0] + (frame[1][0] - width) / 2, frame[0][1] + (frame[1][1] - height) / 2],
        [width, height],
    ];
}

function create(): void {
    gameWindow = findGameWindow();
    if (!gameWindow) throw new Error("no game window yet");
    const rect = frameFor(gameWindow);
    const [, [width, height]] = rect;

    // Titled + closable + resizable + full-size content, title bar invisible: looks borderless but can
    // still take keyboard focus for search boxes. Transparent, so the page draws the rounded panel.
    const style = 1 | 2 | 8 | (1 << 15);
    const w = ObjC.classes.NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(rect, style, 2, 0);
    w.setTitlebarAppearsTransparent_(1);
    w.setTitleVisibility_(1);
    w.setMovableByWindowBackground_(1);
    w.setReleasedWhenClosed_(0);
    w.setOpaque_(0);
    w.setHasShadow_(1);
    w.setBackgroundColor_(ObjC.classes.NSColor.clearColor());
    for (const button of [0, 1, 2]) w.standardWindowButton_(button)?.setHidden_(1); // close/min/zoom

    const config = ObjC.classes.WKWebViewConfiguration.alloc().init();
    const view = ObjC.classes.WKWebView.alloc().initWithFrame_configuration_([[0, 0], [width, height]], config);
    view.setAutoresizingMask_(2 | 16); // flexible width and height
    view.setValue_forKey_(ObjC.classes.NSNumber.numberWithBool_(0), "drawsBackground");

    view.setWantsLayer_(1);
    view.layer().setCornerRadius_(16);
    view.layer().setMasksToBounds_(1);
    w.setContentView_(view);
    view.loadRequest_(ObjC.classes.NSURLRequest.requestWithURL_(ObjC.classes.NSURL.URLWithString_(`${url}?ingame=1`)));

    gameWindow.addChildWindow_ordered_(w, 1); // NSWindowAbove
    keep.push(config, view);
    win = w;
    web = view;
    log("Overlay: created the in-game menu window");
}

export function toggle(): void {
    try {
        if (!win) create();
        if (isOpen()) {
            win!.orderOut_(NULL);
            gameWindow?.makeKeyAndOrderFront_(NULL);
        } else {
            if (gameWindow) win!.setFrame_display_(frameFor(gameWindow), 1); // the game window may have resized
            win!.makeKeyAndOrderFront_(NULL);
        }
    } catch (e) {
        log(`Overlay: couldn't open the in-game menu: ${e}`);
    }
}

/** Toggle from the agent thread (keybinds, mods). */
export function toggleFromAgent(): void {
    if (ObjC.available) ObjC.schedule(ObjC.mainQueue, toggle);
}

export function setOverlaySize(next: { width: number; height: number }): void {
    size = { width: Math.min(0.98, Math.max(0.4, next.width)), height: Math.min(0.98, Math.max(0.4, next.height)) };
    if (!ObjC.available) return;
    ObjC.schedule(ObjC.mainQueue, () => {
        if (win && gameWindow && isOpen()) win.setFrame_display_(frameFor(gameWindow), 1);
    });
}

/** Opens a folder in Finder. */
export function revealFolder(path: string): void {
    if (!ObjC.available) return;
    ObjC.schedule(ObjC.mainQueue, () => {
        ObjC.classes.NSWorkspace.sharedWorkspace().openURL_(ObjC.classes.NSURL.fileURLWithPath_(path));
    });
}

