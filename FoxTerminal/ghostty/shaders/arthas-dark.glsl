// FoxTerminal — Arthas dark. Ice on the rim; prompt stays clean.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));
    vec3 ice = vec3(0.22, 0.58, 0.95);

    vec4 src = texture(iChannel0, uv);
    vec3 col = mix(src.rgb, ice, rim * 0.12);
    float spark = fract(sin(dot(floor(fragCoord * 0.35), vec2(12.9898, 78.233))) * 43758.5453);
    col += ice * step(0.988, spark) * rim * 0.35;

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.18 * (1.0 - prompt);
    col += ice * glow;

    fragColor = vec4(col, src.a);
}
