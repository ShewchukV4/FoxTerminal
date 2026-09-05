// FoxTerminal — Death Note. Blood stays at the TOP and rim. Prompt stays clean.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.62, 0.98, length(p));
    float top = smoothstep(0.78, 1.0, uv.y);

    vec4 src = texture(iChannel0, uv);
    vec2 ca = vec2(0.0010, 0.0) * rim;
    float r = texture(iChannel0, clamp(uv + ca, 0.0, 1.0)).r;
    float b = texture(iChannel0, clamp(uv - ca, 0.0, 1.0)).b;
    vec3 col = mix(src.rgb, vec3(r, src.g, b), rim * 0.55);

    col = mix(col, vec3(0.28, 0.03, 0.03), top * 0.10);
    col = mix(col, vec3(0.42, 0.04, 0.04), rim * 0.10);

    float cell = floor(uv.x * 22.0);
    float h = fract(sin(cell * 19.13) * 43758.5453);
    float dripX = abs(fract(uv.x * 22.0) - 0.5);
    float dripLen = 0.04 + h * 0.07;
    float fromTop = 1.0 - uv.y;
    float drip = (1.0 - smoothstep(0.0, dripLen, fromTop)) * (1.0 - smoothstep(0.10, 0.24, dripX));
    drip *= step(0.82, h) * top;
    col = mix(col, vec3(0.38, 0.03, 0.03), drip * 0.20);

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += vec3(0.69, 0.07, 0.07) * glow;

    fragColor = vec4(col, src.a);
}
