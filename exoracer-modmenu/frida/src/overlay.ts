import ObjC from "frida-objc-bridge";

// The in-game menu: a borderless-looking window attached to the game's window, showing the same
// menu page in a WKWebView. A key (rebindable) toggles it; Esc closes it. All AppKit work happens on
// the main queue. The key monitor only runs on key presses, never per frame.

type Log = (message: string) => void;

export interface KeyBinding {
    code: number; // macOS virtual key code
    label: string;
}

const NS_KEY_DOWN_MASK = 1 << 10;
const KEY_ESCAPE = 53;

let binding: KeyBinding = { code: 50, label: "`" };
let onRebind: (b: KeyBinding) => void = () => {};
let listening = false;
let url = "";
let log: Log = () => {};

let win: ObjC.Object | null = null;
let gameWindow: ObjC.Object | null = null;
const keep: unknown[] = []; // blocks and objects that must outlive this call

export function startOverlay(menuUrl: string, initial: KeyBinding, rebound: (b: KeyBinding) => void, logger: Log): void {
    log = logger;
    url = menuUrl;
    binding = initial;
    onRebind = rebound;
    if (!ObjC.available) return log("Overlay: no Objective-C runtime, in-game menu disabled (the browser menu still works)");
    try {
        Module.load("/System/Library/Frameworks/WebKit.framework/WebKit");
    } catch (e) {
        return log(`Overlay: couldn't load WebKit (${e}); in-game menu disabled`);
    }
    ObjC.schedule(ObjC.mainQueue, () => {
        try {
            installKeyMonitor();
            log(`Overlay: press ${binding.label} in the game to open the menu`);
        } catch (e) {
            log(`Overlay: key monitor failed: ${(e as Error).stack ?? e}`);
        }
    });
}

/** The next key pressed in the game becomes the menu key. */
export function listenForKey(): void {
    listening = true;
}

export function currentKey(): KeyBinding & { listening: boolean } {
    return { ...binding, listening };
}

function installKeyMonitor(): void {
    const handler = new ObjC.Block({
        retType: "pointer",
        argTypes: ["pointer"],
        implementation(event: NativePointer): NativePointer {
            try {
                const ev = new ObjC.Object(event);
                const code = ev.keyCode() as number;
                if (listening) {
                    listening = false;
                    const chars = ev.charactersIgnoringModifiers();
                    const label = chars ? chars.toString().toUpperCase().trim() : "";
                    binding = { code, label: label || `key ${code}` };
                    onRebind(binding);
                    log(`Overlay: menu key is now ${binding.label}`);
                    return NULL; // swallow it
                }
                if (code === binding.code || (code === KEY_ESCAPE && isOpen())) {
                    toggle();
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

function isOpen(): boolean {
    return win !== null && (win.isVisible() as boolean);
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

function create(): void {
    gameWindow = findGameWindow();
    if (!gameWindow) throw new Error("no game window yet");
    const frame = gameWindow.frame() as [[number, number], [number, number]];
    const width = Math.min(880, frame[1][0] - 40);
    const height = Math.min(620, frame[1][1] - 40);
    const rect = [
        [frame[0][0] + (frame[1][0] - width) / 2, frame[0][1] + (frame[1][1] - height) / 2],
        [width, height],
    ];

    // Titled + closable + resizable + full-size content, with the title bar made invisible: it looks
    // borderless but can still take keyboard focus for the search box.
    const style = 1 | 2 | 8 | (1 << 15);
    const w = ObjC.classes.NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(rect, style, 2, 0);
    w.setTitlebarAppearsTransparent_(1);
    w.setTitleVisibility_(1);
    w.setMovableByWindowBackground_(1);
    w.setReleasedWhenClosed_(0);
    w.setBackgroundColor_(ObjC.classes.NSColor.colorWithCalibratedRed_green_blue_alpha_(0.07, 0.075, 0.094, 1));

    const config = ObjC.classes.WKWebViewConfiguration.alloc().init();
    const web = ObjC.classes.WKWebView.alloc().initWithFrame_configuration_([[0, 0], [width, height]], config);
    web.setAutoresizingMask_(2 | 16); // flexible width and height
    w.setContentView_(web);
    web.loadRequest_(ObjC.classes.NSURLRequest.requestWithURL_(ObjC.classes.NSURL.URLWithString_(`${url}?ingame=1`)));

    gameWindow.addChildWindow_ordered_(w, 1); // NSWindowAbove: follows the game window, even fullscreen
    keep.push(config, web);
    win = w;
    log("Overlay: created the in-game menu window");
}

function toggle(): void {
    try {
        if (!win) create();
        if (isOpen()) {
            win!.orderOut_(NULL);
            gameWindow?.makeKeyAndOrderFront_(NULL);
        } else {
            win!.makeKeyAndOrderFront_(NULL);
        }
    } catch (e) {
        log(`Overlay: couldn't open the in-game menu: ${e}`);
    }
}
