# 云端部署说明

推荐使用 Render，因为这个项目是一个不依赖第三方 npm 包的 Node.js 服务。

## 1. 先把项目上传到 GitHub

在 GitHub 新建一个**私有或公开仓库**，进入仓库后选择 **Add file → Upload files**，上传整个 `teen-city-survey` 文件夹里的内容。上传后的仓库根目录应该直接包含：

```text
server.js
package.json
public/
render.yaml
```

不要上传 `data/responses.json`；`.gitignore` 已经将它排除。若之前在 GitHub 页面中手动上传过它，应该删除它，因为答卷数据不适合放在公开仓库里。

## 2. 用 Render 创建服务

1. 打开 [render.com](https://render.com/) 并登录。
2. 选择 **New → Blueprint**。
3. 连接刚才的 GitHub 仓库。
4. Render 读取 `render.yaml` 后，确认服务名为 `teen-city-survey`。
5. 点击创建并部署。
6. Render 会要求填写 `ADMIN_PASSWORD`。请设置一个新的云端密码，不要继续使用 `admin123456`。`ADMIN_USERNAME` 默认是 `Administrator`。

`render.yaml` 使用一个1GB持久磁盘挂载到 `/var/data`，答卷会保存到 `/var/data/responses.json`。这一步很重要：如果不使用持久磁盘，许多免费云平台在重新部署或重启后会清空本地文件，历史答卷会丢失。

部署完成后，Render 会给出一个类似下面的地址：

```text
https://teen-city-survey-xxxx.onrender.com/
```

答题地址是这个地址本身，管理员地址是在末尾加 `/admin`。

如果浏览器显示 `{"error":"页面不存在。"}`，先确认打开的是服务根地址，例如 `https://你的服务.onrender.com/`，而不是 GitHub 仓库地址或 `/api/...` 接口地址。更新代码后，在 Render 的 **Manual Deploy → Deploy latest commit** 重新部署，并用 Ctrl+F5 刷新浏览器。新版服务也支持 `/admin/`、`/index.html` 和带额外网页路径的访问。

如果根地址仍然显示这个错误，请在 Render 的 Deploy Logs 中确认启动日志包含：

```text
Serving public files from .../public
```

如果日志没有这行，说明上传时没有把 `public/` 文件夹放在 `server.js` 同级目录，需调整仓库结构后重新部署。

## 3. 部署后检查

打开：

```text
https://你的域名/
https://你的域名/admin
```

先提交一份测试答卷，再用管理员账号登录，确认历史表里出现Q1–Q12和A/H/F/E四个权重分。测试成功后，再将答题地址发给学生。

## 4. 关键安全设置

- 云端必须在 Render 的 Environment 中设置 `ADMIN_PASSWORD`；生产环境没有密码时服务会拒绝启动。
- 不要把管理员密码写入 GitHub、截图或公开网页。
- 不要把 `data/responses.json` 提交到公开仓库。
- 当前服务只保存每题分数和四个权重，不保存姓名、联系方式或IP地址。
- Render 的默认域名使用 HTTPS；若以后绑定自定义域名，也应保持 HTTPS。

## 本地运行

在项目目录运行：

```powershell
npm start
```

然后打开 `http://127.0.0.1:4173/`。本地开发仍可使用账号 `Administrator` 和密码 `admin123456`；云端请改用新的 `ADMIN_PASSWORD`。
