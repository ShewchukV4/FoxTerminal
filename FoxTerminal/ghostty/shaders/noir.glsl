// FoxTerminal — Noir CRT. Soft scan and grain on the rim; prompt stays clean.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    float rim = smoothstep(0.58, 0.98, length(p * vec2(res.x / res.y, 1.0)));

    vec4 src = texture(iChannel0, uv);
    vec3 col = src.rgb;

    float scan = 0.97 + 0.03 * sin(fragCoord.y * 2.2);
    col = mix(col, col * scan, rim);
    float n = fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 0.018 * rim;
    col *= mix(1.0, 0.88, rim);

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.14 * (1.0 - prompt);
    col += vec3(0.85, 0.85, 0.85) * glow;

    fragColor = vec4(col, src.a);
}
