# 酷狗签到

GitHub Actions 实现 `酷狗概念VIP` 自动签到，每天领取总计 `两天酷狗概念VIP`

登录后即可使用，目前提供二维码登录(推荐)和手机号登录(一个手机号绑定多个账号无法登录，见 [多账号登录问题](https://github.com/MakcRe/KuGouMusicApi/issues/51))

## 免责声明

> [!important]
>
> 1. 本项目仅供学习使用，请尊重版权，请勿利用此项目从事商业行为及非法用途!
> 2. 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在 24小时内清除使用本项目的过程中所产生的版权数据。
> 3. 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。
> 4. **禁止在违反当地法律法规的情况下使用本项目。** 对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。
> 5. 音乐平台不易，请尊重版权，支持正版。
> 6. 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。
> 7. 如果官方音乐平台觉得本项目不妥，可联系本项目更改或移除。

## 使用说明

> [!warning]
> 注意事项
>
> 若登录后听歌领取失败，请到APP 活动中心->天天签到领VIP(这个活动新用户好像没有) 查看当日是否已经领取VIP。

1. Fork 本仓库

1. 创建添加令牌
   - **创建令牌**  
     复制下方官网链接，在浏览器中打开

     ```shell
     https://github.com/settings/personal-access-tokens/new
     ```

   - **登录 GitHub 官网**  
     若登陆后未跳转至token生成页，请再次粘贴链接进行访问
   - **在设置页面配置权限**  
      **Token name 备注**：随意填写
      **Expiration (有效期)**：建议自定义有效期，长期无人维护时不要选择过长
      **Repository access (仓库范围)**：只选择当前 fork 的仓库
      **Repository permissions (仓库权限)**：`Metadata` 保持只读，`Secrets` 设置为读写
      ![精细化个人访问令牌权限](imgs/精细化个人访问令牌权限.png)
   - 滑动到底部，点击绿色的 Generate token 保存按钮
   - 复制生成的字符串，回到本仓库添加到`Secret`，变量名 `PAT`，value 为复制的令牌

1. 登录(两种登录方式任选其一)

   3.1 二维码(推荐)

   运行 Actions `qrcodeLogin` 并进入(若不显示,可以刷新页面)，点击run -> 展开二维码登录, 根据提示操作即可。

   3.2 手机号

   添加手机号到 Secret `PHONE`，运行 Actions `sent` 获取验证码，把验证码添加到 Secret `CODE`；运行Actions `phoneLogin` ，成功即可

1. 启用 Actions `main` , 每天北京时间 01:15 自动签到（可在`main.yml`中设置cron）。启用 Actions `Repository Keepalive` 以保证签到可以长期执行。

API源代码来自 [MakcRe/KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi) ~~图省事直接搬来~~

## Secret 位置

1. 步骤一
   ![步骤一](./imgs/步骤一.jpg)
1. 步骤二
   ![步骤二](./imgs/步骤二.jpg)
1. 步骤三
   ![步骤三](./imgs/步骤三.jpg)
1. 步骤四
   ![步骤四](./imgs/步骤四.jpg)

## 致谢

- 感谢 [@MakcRe](https://github.com/MakcRe) 提供 API 源代码
- 感谢 [@itfw](https://github.com/itfw) 提供二维码显示问题的解决方案
- 感谢 [@klaas8](https://github.com/klaas8) 提供自动写入secret的方法
