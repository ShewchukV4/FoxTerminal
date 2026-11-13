# Known Issues

1. **Self-signed TLS у Safari** — потрібна ручна довіра; без цього WSS не підключиться.
2. **Streaming = JPEG/SignalR**, не повний WebRTC video track. Затримка вища, ніж у нативному WebRTC H.264, особливо на слабкій Wi‑Fi.
3. **Windows.Graphics.Capture** не підключений як основний path (BitBlt). WGC краще для деяких сценаріїв HDR/окремих вікон, але потребує WinRT capture item.
4. **Secure Desktop / UAC** не транслюються і не керуються (навмисно).
5. **Virtual adapters** можуть з’являтись у списку IP; вибір Wi‑Fi покращено, але на складних NIC-конфігах перевіряйте адресу на Dashboard.
6. **Інсталятор MSI** ще не зібраний — зараз portable build.
7. **Редактор кнопок drag-and-drop на телефоні** — базові профілі + import/export є; повноцінний WYSIWYG layout editor ще обмежений.
8. **SignalR frame size** — великі JPEG на слабких пристроях можуть лагати; зменшіть FPS/quality у Settings.
9. **Force Disconnect** у Devices прибирає сесію з словника Agent, але не завжди миттєво рве TCP — клієнт може спробувати reconnect з тим самим token (це очікувано, доки device не Remove).
