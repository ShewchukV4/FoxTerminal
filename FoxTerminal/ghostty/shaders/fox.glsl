// FoxTerminal — FoxNight glass. Rim only; prompt stays clean.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));

    vec4 src = texture(iChannel0, uv);
    vec3 col = src.rgb;
    col *= mix(1.0, 0.92, rim);
    col += vec3(0.86, 0.48, 0.08) * rim * 0.08;

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += iCurrentCursorColor.rgb * glow;

    fragColor = vec4(col, src.a);
}
