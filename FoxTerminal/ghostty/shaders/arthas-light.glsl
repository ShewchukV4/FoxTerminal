// FoxTerminal — Arthas light. Gold on the rim; prompt stays clean.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));
    vec3 gold = vec3(0.91, 0.76, 0.42);

    vec4 src = texture(iChannel0, uv);
    vec3 col = mix(src.rgb, gold, rim * 0.12);
    vec2 moteUv = uv * vec2(16.0, 10.0);
    moteUv.y -= iTime * 0.08;
    float mote = fract(sin(dot(floor(moteUv), vec2(27.1, 91.7))) * 43758.5453);
    col += gold * step(0.990, mote) * rim * 0.35;

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += gold * glow;

    fragColor = vec4(col, src.a);
}
