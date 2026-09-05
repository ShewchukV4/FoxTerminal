// FoxTerminal — Pride. Rainbow on the rim only; prompt stays clean.
vec3 foxHsv(float h, float s, float v) {
    vec3 q = abs(fract(vec3(h) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return v * mix(vec3(1.0), clamp(q - 1.0, 0.0, 1.0), s);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));

    vec4 src = texture(iChannel0, uv);
    float ang = atan(p.y, p.x);
    vec3 rainbow = foxHsv(fract(ang / 6.2831853 + iTime * 0.03), 0.80, 1.0);
    vec3 col = mix(src.rgb, rainbow, rim * 0.14);

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += rainbow * glow;

    fragColor = vec4(col, src.a);
}
