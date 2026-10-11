// Tiny z-buffer triangle rasterizer for preview renders of the exported world.
// Input (little-endian float32 unless noted):
//   header: int32 W, H; float cam[3], fwd[3], right[3], up[3], fovY(deg), sun[3],
//           fogDensity, fogColor[3], skyTop[3], skyHorizon[3]; int32 nTris
//   per triangle: float v[9], color[3], alpha, emissive
// Output: binary RGB float32 W*H*3 to the given path.
// Usage: raster in.bin out.bin
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { float v[9], c[3], a, e; } Tri;
typedef struct { float sx[3], sy[3], z[3]; float col[3]; float a; float depth; } PTri;

static int W, H;
static float cam[3], fwd[3], rgt[3], up[3], fovY, sun[3], fogD, fogC[3], skyT[3], skyH[3];
static float *zbuf, *img;

static float dot3(const float *a, const float *b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

static int project(const float *p, float *sx, float *sy, float *z) {
  float d[3] = {p[0]-cam[0], p[1]-cam[1], p[2]-cam[2]};
  float zz = dot3(d, fwd);
  if (zz < 1.0f) return 0;
  float f = 1.0f / tanf(fovY * 0.5f * (float)M_PI / 180.0f);
  float aspect = (float)W / (float)H;
  *sx = (dot3(d, rgt) / zz * f / aspect * 0.5f + 0.5f) * W;
  *sy = (-dot3(d, up) / zz * f * 0.5f + 0.5f) * H;
  *z = zz;
  return 1;
}

static void shade(const Tri *t, float *out, float dist) {
  float e1[3] = {t->v[3]-t->v[0], t->v[4]-t->v[1], t->v[5]-t->v[2]};
  float e2[3] = {t->v[6]-t->v[0], t->v[7]-t->v[1], t->v[8]-t->v[2]};
  float n[3] = {e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]};
  float len = sqrtf(dot3(n, n));
  if (len > 0) { n[0] /= len; n[1] /= len; n[2] /= len; }
  // face the camera
  float c[3] = {(t->v[0]+t->v[3]+t->v[6])/3 - cam[0], (t->v[1]+t->v[4]+t->v[7])/3 - cam[1], (t->v[2]+t->v[5]+t->v[8])/3 - cam[2]};
  if (dot3(n, c) > 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
  float lam = dot3(n, sun); if (lam < 0) lam = 0;
  float hemi = 0.5f + 0.5f * n[1];
  float k = t->e > 0.5f ? 1.15f : (0.36f + 0.22f * hemi + 0.62f * lam);
  float fog = 1.0f - expf(-dist * fogD);
  for (int i = 0; i < 3; i++) {
    float v = t->c[i] * k;
    out[i] = v * (1 - fog) + fogC[i] * fog;
  }
}

static void raster(const float *sx, const float *sy, const float *z, const float *col, float alpha, int writeZ) {
  float minx = fminf(sx[0], fminf(sx[1], sx[2])), maxx = fmaxf(sx[0], fmaxf(sx[1], sx[2]));
  float miny = fminf(sy[0], fminf(sy[1], sy[2])), maxy = fmaxf(sy[0], fmaxf(sy[1], sy[2]));
  int x0 = (int)fmaxf(0, floorf(minx)), x1 = (int)fminf(W - 1, ceilf(maxx));
  int y0 = (int)fmaxf(0, floorf(miny)), y1 = (int)fminf(H - 1, ceilf(maxy));
  float area = (sx[1]-sx[0])*(sy[2]-sy[0]) - (sx[2]-sx[0])*(sy[1]-sy[0]);
  if (fabsf(area) < 1e-6f) return;
  for (int y = y0; y <= y1; y++) {
    for (int x = x0; x <= x1; x++) {
      float px = x + 0.5f, py = y + 0.5f;
      float w0 = ((sx[1]-px)*(sy[2]-py) - (sx[2]-px)*(sy[1]-py)) / area;
      float w1 = ((sx[2]-px)*(sy[0]-py) - (sx[0]-px)*(sy[2]-py)) / area;
      float w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      // perspective-correct depth
      float iz = w0 / z[0] + w1 / z[1] + w2 / z[2];
      float zz = 1.0f / iz;
      int idx = y * W + x;
      if (zz >= zbuf[idx]) continue;
      if (writeZ) zbuf[idx] = zz;
      float *o = img + idx * 3;
      for (int i = 0; i < 3; i++) o[i] = o[i] * (1 - alpha) + col[i] * alpha;
    }
  }
}

static int cmpDepth(const void *a, const void *b) {
  float da = ((const PTri *)a)->depth, db = ((const PTri *)b)->depth;
  return da < db ? 1 : (da > db ? -1 : 0);
}

int main(int argc, char **argv) {
  if (argc < 3) { fprintf(stderr, "usage: raster in.bin out.bin\n"); return 1; }
  FILE *f = fopen(argv[1], "rb");
  if (!f) { perror("open"); return 1; }
  int n;
  if (fread(&W, 4, 1, f) != 1 || fread(&H, 4, 1, f) != 1) return 1;
  float hdr[3 + 3 + 3 + 3 + 1 + 3 + 1 + 3 + 3 + 3];
  if (fread(hdr, sizeof(hdr), 1, f) != 1) return 1;
  memcpy(cam, hdr, 12); memcpy(fwd, hdr + 3, 12); memcpy(rgt, hdr + 6, 12); memcpy(up, hdr + 9, 12);
  fovY = hdr[12]; memcpy(sun, hdr + 13, 12); fogD = hdr[16]; memcpy(fogC, hdr + 17, 12);
  memcpy(skyT, hdr + 20, 12); memcpy(skyH, hdr + 23, 12);
  if (fread(&n, 4, 1, f) != 1) return 1;
  Tri *tris = malloc(sizeof(Tri) * (size_t)n);
  if (fread(tris, sizeof(Tri), (size_t)n, f) != (size_t)n) { fprintf(stderr, "short read\n"); return 1; }
  fclose(f);
  zbuf = malloc(sizeof(float) * W * H);
  img = malloc(sizeof(float) * W * H * 3);
  for (int y = 0; y < H; y++) {
    float t = (float)y / H;
    // sky gradient: zenith at the top, hazy horizon near the middle
    float k = fminf(1.0f, t * 1.6f);
    for (int x = 0; x < W; x++) {
      zbuf[y * W + x] = 1e30f;
      for (int i = 0; i < 3; i++) img[(y * W + x) * 3 + i] = skyT[i] * (1 - k) + skyH[i] * k;
    }
  }
  PTri *trans = malloc(sizeof(PTri) * (size_t)n);
  int nt = 0;
  for (int i = 0; i < n; i++) {
    Tri *t = &tris[i];
    float sx[3], sy[3], z[3];
    int ok = 1;
    for (int k = 0; k < 3; k++) ok &= project(t->v + 3 * k, &sx[k], &sy[k], &z[k]);
    if (!ok) continue;
    float col[3];
    float dist = (z[0] + z[1] + z[2]) / 3;
    shade(t, col, dist);
    if (t->a >= 0.999f) {
      raster(sx, sy, z, col, 1.0f, 1);
    } else {
      PTri *p = &trans[nt++];
      memcpy(p->sx, sx, 12); memcpy(p->sy, sy, 12); memcpy(p->z, z, 12); memcpy(p->col, col, 12);
      p->a = t->a; p->depth = dist;
    }
  }
  qsort(trans, (size_t)nt, sizeof(PTri), cmpDepth);
  for (int i = 0; i < nt; i++) raster(trans[i].sx, trans[i].sy, trans[i].z, trans[i].col, trans[i].a, 0);
  FILE *o = fopen(argv[2], "wb");
  fwrite(img, sizeof(float), (size_t)W * H * 3, o);
  fclose(o);
  fprintf(stderr, "rendered %d tris (%d transparent)\n", n, nt);
  return 0;
}
