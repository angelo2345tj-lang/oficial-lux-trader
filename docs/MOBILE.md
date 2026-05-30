# Lux Trader FX — Mobile (Capacitor + Android)

## Pré-requisitos

- Node.js 20+
- Android Studio (Ladybug+)
- JDK 17
- Android SDK 34+

## Instalação inicial

```bash
npm install
npm run build:mobile
npx cap add android
npm run cap:sync:android
```

## Desenvolvimento

```bash
npm run dev:web
# Em outro terminal, após build:
npm run cap:open:android
```

## Build debug (APK)

```bash
npm run android:debug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Build release (AAB / Play Store)

1. Crie o keystore:

```bash
keytool -genkey -v -keystore lux-trader-release.keystore -alias luxtrader -keyalg RSA -keysize 2048 -validity 10000
```

2. Copie `android/keystore.properties.example` → `android/keystore.properties` e preencha.

3. Aplique overlays em `android-overlays/` (ProGuard, network security, permissões).

4. Build:

```bash
npm run android:release
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

## Assinatura release (Android Studio)

1. `npm run cap:open:android`
2. **Build → Generate Signed Bundle / APK**
3. Escolha **Android App Bundle**
4. Selecione keystore e alias

## Play Store

- `appId`: `com.luxtraderfx.app`
- Ícones adaptativos em `android/app/src/main/res/`
- Política de permissões: `android-overlays/PERMISSIONS.md`
- Screenshots: 1080×1920 (phone)

## iOS (futuro)

```bash
npx cap add ios
npm run cap:sync
npx cap open ios
```

Arquitetura já preparada: safe-area, status bar, splash, lifecycle WS em `services/mobile/`.

## Windows / Desktop PWA

- Instale pelo Chrome/Edge: **Instalar aplicativo**
- `display: standalone` no `manifest.json`
- WebSocket estável via `MobileInstitutionalSocket` + `BinanceStreamEngine`

## Logs

| Canal | Uso |
|-------|-----|
| `[Lux:Mobile]` | Bootstrap geral |
| `[Lux:Android]` | Device info |
| `[Lux:PWA]` | Standalone / cache |
| `[Lux:Socket]` | Conexão Binance |
| `[Lux:Reconnect]` | Backoff institucional |
| `[Lux:Background]` | App pause/resume |
| `[Lux:WakeLock]` | Keep-awake análise |
| `[Lux:Notifications]` | Push local |

## Garantias

- Um único `BinanceStreamEngine` / socket
- Reconnect não reseta score IA (cache `offlineCache` + `signalStore`)
- Background: `retain()` mantido; `release()` só sem background
