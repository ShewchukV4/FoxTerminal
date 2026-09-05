// FoxTerminal - sw slate. Rim effect only; prompt stays clean.
const vec3 ACCENT = vec3(0.490, 0.576, 0.690);
const int STYLE = 19;

float foxHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));
    float top = smoothstep(0.78, 1.0, uv.y);
    float sides = smoothstep(0.38, 0.48, abs(uv.x - 0.5));

    vec4 src = texture(iChannel0, uv);
    vec3 col = src.rgb;
    float amt = rim * 0.11;

    if (STYLE == 1) {
        float wave = 0.5 + 0.5 * sin(uv.x * 7.0 + uv.y * 5.0 + iTime * 0.35);
        amt = top * (0.09 + 0.05 * wave);
    } else if (STYLE == 2) {
        amt = rim * 0.12 + step(0.987, foxHash(floor(uv * 40.0) + iTime * 0.05)) * rim * 0.25;
    } else if (STYLE == 3) {
        float rip = sin((uv.x + uv.y) * 28.0 + iTime * 1.6);
        amt = rim * (0.08 + 0.04 * rip);
    } else if (STYLE == 4) {
        amt = rim * (0.08 + 0.05 * (0.5 + 0.5 * sin(iTime * 2.4)));
    } else if (STYLE == 5) {
        vec2 petal = uv * vec2(14.0, 9.0);
        petal.y += iTime * 0.10;
        amt = rim * 0.08 + step(0.989, foxHash(floor(petal))) * rim * 0.28;
    } else if (STYLE == 6) {
        amt = sides * 0.10 + rim * 0.06;
    } else if (STYLE == 7) {
        float ang = atan(p.y, p.x) + iTime * 0.2;
        amt = rim * (0.08 + 0.05 * step(0.82, fract(ang * 2.5)));
    } else if (STYLE == 8) {
        amt = rim * 0.08 + step(0.993, foxHash(floor(uv * 70.0))) * 0.35;
    } else if (STYLE == 9) {
        float cloud = 0.5 + 0.5 * sin(uv.x * 4.0 + iTime * 0.15) * sin(uv.y * 3.0);
        amt = top * (0.08 + 0.05 * cloud);
    } else if (STYLE == 10) {
        float cau = sin(uv.x * 18.0 + iTime) * sin(uv.y * 14.0 - iTime * 0.7);
        amt = rim * (0.07 + 0.05 * cau);
    } else if (STYLE == 11) {
        amt = rim * 0.08 + step(0.991, foxHash(floor(fragCoord * 0.2) + iTime)) * rim * 0.30;
    } else if (STYLE == 12) {
        float dap = foxHash(floor(uv * vec2(9.0, 6.0)));
        amt = rim * (0.07 + 0.06 * dap);
    } else if (STYLE == 13) {
        float tick = step(0.92, fract(fragCoord.y * 0.08 + iTime * 3.0));
        amt = rim * (0.07 + 0.06 * tick);
    } else if (STYLE == 14) {
        vec2 dust = uv * vec2(16.0, 11.0);
        dust.y += iTime * 0.07;
        amt = rim * 0.08 + step(0.990, foxHash(floor(dust))) * rim * 0.30;
    } else if (STYLE == 15) {
        vec2 c1 = uv - vec2(0.0, 1.0);
        vec2 c2 = uv - vec2(1.0, 1.0);
        float lamps = exp(-dot(c1, c1) * 8.0) + exp(-dot(c2, c2) * 8.0);
        amt = lamps * 0.12 + rim * 0.05;
    } else if (STYLE == 16) {
        amt = top * 0.12;
    } else if (STYLE == 17) {
        float sh = sin(uv.x * 22.0 + iTime * 0.8) * cos(uv.y * 10.0);
        amt = rim * (0.08 + 0.04 * sh);
    } else if (STYLE == 18) {
        amt = rim * 0.09 + step(0.992, foxHash(floor(uv * 55.0 + iTime * 0.2))) * 0.32;
    } else if (STYLE == 19) {
        amt = 0.0;
    }
    } else if (STYLE == 20) {
        amt = rim * 0.10 + step(0.988, foxHash(floor(uv * 30.0))) * rim * 0.22;
    } else if (STYLE == 21) {
        float scan = 0.5 + 0.5 * sin(fragCoord.y * 0.35 + iTime * 6.0);
        amt = rim * (0.08 + 0.05 * scan);
    } else if (STYLE == 22) {
        float shaft = pow(max(0.0, 1.0 - abs(fract(uv.x * 5.0 + iTime * 0.03) - 0.5) * 4.0), 3.0);
        amt = top * shaft * 0.10 + rim * 0.05;
    } else if (STYLE == 23) {
        float steam = 0.5 + 0.5 * sin(uv.x * 10.0 + iTime * 0.5);
        amt = top * (0.07 + 0.04 * steam);
    } else if (STYLE == 24) {
        amt = rim * 0.14;
    } else if (STYLE == 25) {
        amt = rim * 0.08 + (foxHash(floor(fragCoord * 0.5)) - 0.5) * 0.03 * rim;
    }

    col = mix(col, ACCENT, clamp(amt, 0.0, 0.16));

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += ACCENT * glow;

    fragColor = vec4(col, src.a);
}