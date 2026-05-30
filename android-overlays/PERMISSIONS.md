# Permissões Android — Lux Trader FX

| Permissão | Motivo |
|-----------|--------|
| `INTERNET` | API + WebSocket Binance |
| `ACCESS_NETWORK_STATE` | Detecção offline/online |
| `POST_NOTIFICATIONS` | Alertas de sinais (Android 13+) |
| `VIBRATE` | Feedback em notificações |
| `WAKE_LOCK` | Manter análise/WS durante sessão ativa |
| `FOREGROUND_SERVICE` | Serviço em background (opcional, overlay) |

Não solicitamos: localização, câmera, microfone, contatos.
