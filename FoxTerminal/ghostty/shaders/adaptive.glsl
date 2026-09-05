// FoxTerminal - pane-local glass. One program for the window.
// Each split keeps its own look because OSC tints the pane background
// and we classify that color. Text (bright pixels) is never touched.

float foxHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 foxHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 foxNightTint(vec3 accent) {
    return mix(vec3(0.043, 0.059, 0.102), accent, 0.12);
}

int foxNearestTint(vec3 probe) {
    vec3 accents[26];
    accents[0] = vec3(0.863, 0.478, 0.078);
    accents[1] = vec3(0.353, 0.549, 1.000);
    accents[2] = vec3(0.627, 0.353, 1.000);
    accents[3] = vec3(0.275, 0.863, 0.784);
    accents[4] = vec3(0.820, 0.290, 0.353);
    accents[5] = vec3(0.878, 0.353, 0.604);
    accents[6] = vec3(0.831, 0.294, 0.741);
    accents[7] = vec3(0.514, 0.337, 0.902);
    accents[8] = vec3(0.306, 0.459, 0.847);
    accents[9] = vec3(0.435, 0.769, 0.941);
    accents[10] = vec3(0.212, 0.722, 0.702);
    accents[11] = vec3(0.420, 0.827, 0.690);
    accents[12] = vec3(0.298, 0.722, 0.455);
    accents[13] = vec3(0.608, 0.851, 0.290);
    accents[14] = vec3(0.878, 0.694, 0.282);
    accents[15] = vec3(0.898, 0.580, 0.227);
    accents[16] = vec3(0.906, 0.639, 0.486);
    accents[17] = vec3(0.878, 0.490, 0.412);
    accents[18] = vec3(0.784, 0.231, 0.361);
    accents[19] = vec3(0.490, 0.576, 0.690);
    accents[20] = vec3(0.486, 0.784, 0.910);
    accents[21] = vec3(0.494, 0.941, 0.420);
    accents[22] = vec3(0.306, 0.549, 0.400);
    accents[23] = vec3(0.631, 0.478, 0.353);
    accents[24] = vec3(0.310, 0.357, 0.416);
    accents[25] = vec3(0.804, 0.835, 0.878);

    int best = -1;
    float bestD = 0.10;
    for (int i = 0; i < 26; i++) {
        float d = distance(probe, foxNightTint(accents[i]));
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

int foxStyle(vec3 hsv, vec3 probe) {
    int tinted = foxNearestTint(probe);
    if (tinted >= 0) return tinted;

    float h = hsv.x * 360.0;
    float s = hsv.y;
    float v = hsv.z;
    if (v < 0.028 && s < 0.18) return 27;
    if (v < 0.048 && s < 0.10) return 26;
    if (s < 0.10 && v > 0.45) return 25;
    if (s < 0.14 && v < 0.18) return 24;
    if (h > 205.0 && h < 235.0 && v < 0.30) return 19;
    if (h < 8.0 || h > 348.0) return (s > 0.35) ? 27 : 4;
    if (h < 18.0) return 17;
    if (h < 28.0) return (v > 0.14) ? 16 : 0;
    if (h < 36.0) return (s > 0.40) ? 15 : 23;
    if (h < 48.0) return (v > 0.16) ? 14 : 29;
    if (h < 100.0) return 13;
    if (h < 125.0) return 21;
    if (h < 148.0) return (s < 0.35) ? 22 : 12;
    if (h < 165.0) return 11;
    if (h < 176.0) return 3;
    if (h < 188.0) return 10;
    if (h < 205.0) return (v < 0.12) ? 28 : 9;
    if (h < 232.0) return (v < 0.12) ? 28 : 1;
    if (h < 250.0) return 8;
    if (h < 272.0) return 7;
    if (h < 295.0) return 2;
    if (h < 325.0) return 6;
    return 5;
}

vec3 foxAccent(int style) {
    if (style == 1) return vec3(0.353, 0.549, 1.000);
    if (style == 2) return vec3(0.627, 0.353, 1.000);
    if (style == 3) return vec3(0.275, 0.863, 0.784);
    if (style == 4) return vec3(0.820, 0.290, 0.353);
    if (style == 5) return vec3(0.878, 0.353, 0.604);
    if (style == 6) return vec3(0.831, 0.294, 0.741);
    if (style == 7) return vec3(0.514, 0.337, 0.902);
    if (style == 8) return vec3(0.306, 0.459, 0.847);
    if (style == 9) return vec3(0.435, 0.769, 0.941);
    if (style == 10) return vec3(0.212, 0.722, 0.702);
    if (style == 11) return vec3(0.420, 0.827, 0.690);
    if (style == 12) return vec3(0.298, 0.722, 0.455);
    if (style == 13) return vec3(0.608, 0.851, 0.290);
    if (style == 14) return vec3(0.878, 0.694, 0.282);
    if (style == 15) return vec3(0.898, 0.580, 0.227);
    if (style == 16) return vec3(0.906, 0.639, 0.486);
    if (style == 17) return vec3(0.878, 0.490, 0.412);
    if (style == 18) return vec3(0.784, 0.231, 0.361);
    if (style == 19) return vec3(0.490, 0.576, 0.690);
    if (style == 20) return vec3(0.486, 0.784, 0.910);
    if (style == 21) return vec3(0.494, 0.941, 0.420);
    if (style == 22) return vec3(0.306, 0.549, 0.400);
    if (style == 23) return vec3(0.631, 0.478, 0.353);
    if (style == 24) return vec3(0.310, 0.357, 0.416);
    if (style == 25) return vec3(0.804, 0.835, 0.878);
    if (style == 26) return vec3(0.55, 0.55, 0.55);
    if (style == 27) return vec3(0.69, 0.07, 0.07);
    if (style == 28) return vec3(0.22, 0.58, 0.95);
    if (style == 29) return vec3(0.91, 0.76, 0.42);
    return vec3(0.863, 0.478, 0.078);
}

float foxDivider(vec2 uv, vec2 res) {
    vec3 mark = vec3(0.478, 0.635, 0.969);
    float hit = 0.0;
    for (int i = 1; i <= 6; i++) {
        float s = float(i);
        hit = max(hit, 1.0 - smoothstep(0.06, 0.16, distance(texture(iChannel0, uv + vec2(s, 0.0) / res).rgb, mark)));
        hit = max(hit, 1.0 - smoothstep(0.06, 0.16, distance(texture(iChannel0, uv - vec2(s, 0.0) / res).rgb, mark)));
        hit = max(hit, 1.0 - smoothstep(0.06, 0.16, distance(texture(iChannel0, uv + vec2(0.0, s) / res).rgb, mark)));
        hit = max(hit, 1.0 - smoothstep(0.06, 0.16, distance(texture(iChannel0, uv - vec2(0.0, s) / res).rgb, mark)));
    }
    return hit;
}

vec3 foxSlateRain(vec2 uv, vec2 res, vec3 col, vec3 accent) {
    float rain = 0.0;
    for (int k = 0; k < 3; k++) {
        float layer = float(k);
        float cols = 85.0 + layer * 35.0;
        float id = floor(uv.x * cols + layer * 3.7);
        float h = foxHash(vec2(id, 8.1 + layer));
        if (h < 0.28) {
            continue;
        }
        float speed = 0.22 + h * 0.35;
        float y = fract(uv.y * (0.85 + 0.2 * h) + iTime * speed + h);
        float x = abs(fract(uv.x * cols) - 0.5);
        float thin = 1.0 - smoothstep(0.0, 0.42, x * 22.0);
        float body = smoothstep(1.0, 0.15, y) * smoothstep(0.0, 0.08, y + 0.02);
        rain += thin * body * (0.35 + 0.65 * h);
    }

    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float glow = 1.0 - smoothstep(0.0, 0.028, edge);

    vec3 wet = col + accent * rain * 0.10;
    wet = mix(wet, accent, glow * 0.03);
    return wet;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec4 src = texture(iChannel0, uv);
    vec3 col = src.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    if (lum > 0.26) {
        fragColor = src;
        return;
    }

    vec3 probe = col;
    float probeLum = lum;
    for (int i = 1; i <= 4; i++) {
        vec3 s = texture(iChannel0, clamp(uv + vec2(0.0, -float(i) * 3.0) / res, 0.0, 1.0)).rgb;
        float sl = dot(s, vec3(0.299, 0.587, 0.114));
        if (sl < probeLum) {
            probe = s;
            probeLum = sl;
        }
    }

    int style = foxStyle(foxHsv(probe), probe);
    vec3 accent = foxAccent(style);
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float winRim = 1.0 - smoothstep(0.0, 0.045, edge);
    float seam = foxDivider(uv, res);
    float rim = max(winRim, seam * 0.55);
    float top = smoothstep(0.80, 1.0, uv.y) * (1.0 - seam);
    float sides = max(1.0 - smoothstep(0.0, 0.08, uv.x), 1.0 - smoothstep(0.0, 0.08, 1.0 - uv.x));
    sides = max(sides, seam);

    if (style == 19) {
        col = foxSlateRain(uv, res, col, accent);
    } else if (style == 26) {
        float scan = 0.97 + 0.03 * sin(fragCoord.y * 2.2);
        float n = foxHash(fragCoord) - 0.5;
        col = mix(col, col * scan + n * 0.02, rim);
    } else if (style == 27) {
        col = mix(col, vec3(0.28, 0.03, 0.03), top * 0.10 + rim * 0.08);
    } else if (style == 28) {
        col = mix(col, accent, rim * 0.12);
        col += accent * step(0.988, foxHash(floor(fragCoord * 0.35))) * rim * 0.30;
    } else if (style == 29) {
        col = mix(col, accent, rim * 0.12);
    } else if (style == 1) {
        float wave = 0.5 + 0.5 * sin(uv.x * 7.0 + uv.y * 5.0 + iTime * 0.35);
        col = mix(col, accent, top * (0.09 + 0.05 * wave));
    } else if (style == 3) {
        float rip = sin((uv.x + uv.y) * 28.0 + iTime * 1.6);
        col = mix(col, accent, rim * (0.08 + 0.04 * rip));
    } else if (style == 9) {
        float cloud = 0.5 + 0.5 * sin(uv.x * 4.0 + iTime * 0.15) * sin(uv.y * 3.0);
        col = mix(col, accent, top * (0.08 + 0.05 * cloud));
    } else if (style == 21) {
        float scan = 0.5 + 0.5 * sin(fragCoord.y * 0.35 + iTime * 6.0);
        col = mix(col, accent, rim * (0.08 + 0.05 * scan));
    } else if (style == 14) {
        vec2 dust = uv * vec2(16.0, 11.0);
        dust.y += iTime * 0.07;
        col += accent * step(0.990, foxHash(floor(dust))) * 0.28;
        col = mix(col, accent, rim * 0.08);
    } else {
        col = mix(col, accent, rim * 0.11);
    }

    fragColor = vec4(col, src.a);
}
