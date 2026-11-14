# 部署到本机 k8s（k3d/kind/Docker Desktop 皆可）

## 前置

- docker（本机构建镜像）
- kubectl（context 指向目标集群）
- k3d 集群需先把镜像导入集群：`k3d image import <image> -c <cluster>`

## 三步部署

```bash
# 1. 构建镜像（本机架构；k3d 与 docker 同宿主，架构一致）
docker build -t the-new-world:0.7.0 .

# 2.（仅 k3d）把镜像导入集群
k3d image import the-new-world:0.7.0 -c k3d-proteus-sandbox

# 3. 应用清单（namespace + deployment + service）
kubectl apply -f deploy/k8s/
kubectl -n the-new-world rollout status deployment/the-new-world
```

## 看效果

```bash
# 集群内验证
kubectl -n the-new-world get pods,svc
kubectl -n the-new-world run curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -s http://the-new-world.the-new-world.svc/healthz

# 本机访问（port-forward）
kubectl -n the-new-world port-forward svc/the-new-world 8081:80
# 浏览器打开 http://localhost:8081
```

## MCP HTTP 端点

```bash
curl -s -X POST http://localhost:8081/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

任何 agent 平台可用 Streamable HTTP 接入：`POST http://<svc>/mcp`（单条 JSON-RPC，
application/json 单响应，符合 MCP 规范 2025-03-26 Transports 章节）。

## 清理

```bash
kubectl delete namespace the-new-world   # 整体移除，不留痕迹
```
