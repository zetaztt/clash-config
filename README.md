# Clash 配置

用于生成个人使用的 Clash Verge Rev / Mihomo 配置。住宅代理链路是当前支持的配置需求之一，后续可以继续按实际需要扩展其他配置。

## 环境要求

- Node.js 24.3.0 或更高版本（包含 npm）
- Clash Verge Rev 或其他兼容 Mihomo 配置的客户端

## 安装

在仓库根目录安装 lockfile 中固定的依赖：

```console
npm ci
```

## 住宅代理设置

在仓库的 `data` 目录中创建不会纳入版本控制的 `proxies.json`。该文件包含订阅地址和住宅节点凭据，只能保存在本地。`residentials` 的键会成为 Mihomo 住宅节点名，可以按需命名并添加多个节点：

```json
{
	"airportUrl": "https://example.com/subscription?token=replace-me",
	"residentials": {
		"JP-IP": {
			"server": "jp-residential.example.com",
			"port": 12345,
			"username": "replace-me",
			"password": "replace-me"
		},
		"US-IP": {
			"server": "us-residential.example.com",
			"port": 23456,
			"username": "replace-me",
			"password": "replace-me"
		}
	}
}
```

住宅节点名不能与 `代理`、`风控策略`、`代理节点`、`住宅节点`、`广告拦截`、`最终代理`、`DIRECT`，以及
`REJECT`、`REJECT-DROP`、`PASS`、`PASS-RULE`、`COMPATIBLE`、`GLOBAL` 等 Mihomo
内置名称冲突。

所有住宅节点都会加入 `住宅节点`，并通过 `代理节点` 建立链式代理。一般业务代理规则使用
`代理` 组，可在 `代理节点` 和 `住宅节点` 之间选择；ChatGPT、Claude 和 Cloudflare 验证等
现有住宅风控规则使用 `风控策略`，默认选择 `住宅节点`，也可切换为 `代理`。最终兜底规则
使用 `最终代理` 组，可在 `代理` 和 `DIRECT`（直连）之间选择。

## 生成配置

使用默认输入 `data/proxies.json` 生成 `dist/clash-config.yaml`：

```console
npm run build
```

也可以显式指定输入和输出路径：

```console
npm run build -- --proxies ./data/proxies.personal.json --output ./dist/custom.generated.yaml
```

输入通过校验后，生成器会直接覆盖目标文件。`dist/` 和 `*.generated.yaml` 已被 Git 忽略；
使用自定义输出路径时，应继续放在 `dist/` 中或使用 `*.generated.yaml` 文件名。

> [!WARNING]
> 生成的 YAML 包含订阅令牌和住宅代理凭据。不要提交、上传或分享该文件。

## 导入 Clash Verge Rev

生成后，在 Clash Verge Rev 的配置或订阅页面导入本地 YAML 文件，并选择
`dist/clash-config.yaml`。不同版本的菜单名称可能略有差异；导入后启用该配置即可。

## GEO 数据

生成配置启用 DAT 格式的 GEO 数据，并从 Loyalsoldier `v2ray-rules-dat` 的最新 Release 下载
`geoip.dat` 和 `geosite.dat`。Mihomo 会自动更新这两个文件，更新间隔为 24 小时。内置的
`apple-cn`、`apple`、`cn`、`gfw` 等 GeoSite 规则均以该数据源为准。

## DNS 防污染

生成配置允许 IPv4 和 IPv6 流量，并启用 Mihomo Fake-IP DNS 的 A/AAAA 解析，同时显式启用
Mihomo 配置 hosts 与系统 hosts 查询。局域网域名使用系统解析器，中国域名使用阿里公共 DoH；
其他域名使用 Cloudflare 和 Google DoH，并明确通过 `代理` 连接，避免海外 DNS 请求被
本地网络抢答或污染。Windows 网络状态检测域名和小米服务域名返回真实 IP，以兼容系统联网
检测和相关设备服务。代理节点域名使用阿里与腾讯 DoH 提供冗余，避免代理解析产生循环依赖；
直连目标使用国内 DoH，让直连 CDN 获得更合适的解析结果。

`default-nameserver` 中的明文 DNS 仅负责解析加密 DNS 服务自身的域名。后续 DoH 连接仍会
校验证书，因此被篡改的引导结果不会作为目标域名的最终解析结果。

Fake-IP 映射会持久化，避免 Mihomo 重启后为已缓存域名重新分配映射地址。TCP 连接会并发
尝试 DNS 返回的多个地址并采用最先成功的连接；该行为不影响 UDP 或 QUIC。

## 内置路由规则

国内游戏平台下载通过 Loyalsoldier GeoSite 的 `category-game-platforms-download@cn` 分类
直接连接，覆盖 Steam、Epic Games、战网、Xbox 和 Ubisoft 等平台标记为中国大陆接入点的
下载/CDN 域名。另行维护少量尚未被该分类收录、用途明确的 Steam 下载域名；不再将完整的
Steam、Epic Games、Easy Anti-Cheat、Unreal Engine 域名或全球 Steam CDN IP 设为直连。

Apple 在中国大陆可直连的服务通过 Loyalsoldier GeoSite 的 `apple-cn` 分类直接连接，其余
`apple` 分类流量使用 `代理`；`apple-cn` 规则必须位于更宽泛的 `apple` 规则之前。

Loyalsoldier GeoSite 的 `category-ads-all` 分类会进入 `广告拦截` 组。该分类汇总多个上游
广告和跟踪域名列表，并随 `geosite.dat` 每 24 小时自动更新。该组默认选择 `REJECT`，也可以
在 Clash Verge Rev 中切换为 `PASS`，跳过当前广告规则并继续后续正常分流；`PASS` 不等同于
`DIRECT`。选择结果会随其他代理组一起保存。如果分类规则发生误拦，应在广告规则块之前添加
指向该域名正常出口的显式规则，不预置第二条广告规则。

`scripts/config.ts` 中的 `rulesConfigs` 是有序规则块数组。外层数组顺序决定业务规则块的
优先级，每个块的 `rules` 对象按规则类型聚合同类值。存在策略优先级关系时应拆成两个
外层规则块；没有优先级差异的同策略规则直接聚合在一个块中。规则块只能选择策略组或允许的
Mihomo 内置策略，不能直接选择 `代理节点` 或 `住宅节点`。

所有内置规则都作为专项规则直接维护。当前优先级以 `rulesConfigs` 的声明顺序为准，可以按
实际路由需求调整；生成器保持声明顺序，并在末尾追加 `MATCH,最终代理`。

当前规则先匹配域名，再匹配不会主动解析的公共 DNS IP，随后才进入允许目标 IP 解析的
`GEOIP,private`、海外服务 IP 和中国 IP 分类。`GEOIP,private` 有意不使用 `no-resolve`，
因此在尚无目标 IP 时可以主动触发解析；系统 hosts 可以提供目标 IP，但具体解析器仍由 DNS
配置决定。GFW/GreatFire 域名优先于中国域名直连，海外服务 IP 优先于中国 IP 直连。

内置规则有意不包含 UDP/443 阻断，以保留 QUIC / HTTP/3；也不包含
无法等价表达的独立 `port`、`network` 或 `protocol` 条件。生成器会为
`GEOIP,private,DIRECT` 之前的所有目标 IP 规则附加 `no-resolve`；该边界规则及之后的目标
IP 规则允许解析。不同规则块之间的重复
matcher 仍按 `rulesConfigs` 的声明顺序匹配。
