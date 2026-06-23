# WorkBuddy Remote Agent 内网穿透配置

## 1. frp（推荐用于长期稳定使用）

假设你拥有一台公网服务器（IP: `1.2.3.4`），已安装 `frps` 服务端。

### 服务端配置（frps.toml）

```toml
bindPort = 7000
auth.method = "token"
auth.token = "your_secure_token_here"
```

启动服务端：

```bash
./frps -c frps.toml
```

### 客户端配置（frpc.toml）

将 `frpc.toml` 放到 PC 端 Agent 同级目录：

```toml
serverAddr = "1.2.3.4"
serverPort = 7000
auth.method = "token"
auth.token = "your_secure_token_here"

[[proxies]]
name = "workbuddy-agent"
type = "tcp"
localPort = 3456
remotePort = 3456
```

启动客户端：

```bash
./frpc -c frpc.toml
```

完成后，手机端将 `ws://localhost:3456` 替换为 `ws://1.2.3.4:3456` 即可。

---

## 2. ngrok（免费版，适合快速测试）

下载 ngrok 并注册获取 Authtoken。

### 快速启动

```bash
ngrok http 3456
```

执行后会分配一个临时域名（如 `https://abc123.ngrok-free.app`）。

- REST API：`https://abc123.ngrok-free.app/api/status`
- WebSocket：`wss://abc123.ngrok-free.app`

> **注意**：ngrok 免费版域名每次启动都会变化，不适合长期部署。建议仅在开发测试阶段使用。

### 添加 Basic Auth（可选）

```bash
ngrok http 3456 --basic-auth="user:password"
```

---

## 3. 安全注意事项

1. **Token 鉴权**：frp 必须配置 `auth.token`，避免被他人扫描利用。
2. **Basic Auth**：ngrok 测试时建议开启 `--basic-auth`，防止接口暴露。
3. **HTTPS/WSS**：生产环境务必使用 TLS 加密（frp 支持 `type = "https"` + 证书，或 ngrok 默认提供 HTTPS）。
4. **IP 白名单**：如有条件，在公网服务器防火墙限制 `remotePort` 的访问来源 IP。
5. **定期更换 Token**：建议每月轮换 frp Token 和 ngrok Authtoken。

---

## 4. Flutter 端配置切换

在 `lib/main.dart` 中修改 `_baseUrl` 和 `_wsUrl`：

```dart
final String _baseUrl = 'https://your-domain.com:3456'; // 或 ngrok HTTPS 地址
final String _wsUrl = 'wss://your-domain.com:3456';       // 注意使用 wss://
```
