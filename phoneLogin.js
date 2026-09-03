import { printBlue, printGreen, printRed, printYellow } from "./utils/colorOut.js";
import { hasSecretWriteToken, setRepoSecret } from "./utils/githubSecrets.js";
import { maskIdentifier, sanitizeForLog, shouldPrintSensitiveValue, summarizeResponse } from "./utils/safeLog.js";
import { loadUserinfo, saveUserinfoToFile } from "./utils/userinfoStore.js";
import { close_api, delay, send, startService } from "./utils/utils.js";

async function login() {

  const phone = process.env.PHONE
  const code = process.env.CODE
  const USERINFO = process.env.USERINFO
  const APPEND_USER = process.env.APPEND_USER
  const localUserinfo = APPEND_USER && APPEND_USER !== "0" && !USERINFO
    ? loadUserinfo({ allowMissing: true })
    : []
  const userinfo = (USERINFO && APPEND_USER == "是") ? JSON.parse(USERINFO) : []
  userinfo.push(...localUserinfo)

  // 不使用二维码登录并且没有手机号或验证码
  if (!phone || !code) {
    throw new Error("未配置")
  }
  // 启动服务
  const api = startService()
  await delay(2000)

  try {
    // 手机号登录请求
    const result = await send(`/login/cellphone?mobile=${phone}&code=${code}`, "GET", {})
    if (result.status === 1) {

      let userAlreadyExist = false
      printGreen("登录成功！")
      if (APPEND_USER == "是") {
        for (let i = 0; i < userinfo.length; i++) {

          if (userinfo[i].userid == result.data.userid) {
            userAlreadyExist = true
            printYellow(`userid: ${maskIdentifier(userinfo[i].userid)} 此账号已存在, 仅更新登录信息`)
            userinfo[i].token = result.data.token
          }
        }
      }
      if (!userAlreadyExist) {
        userinfo.push({
          userid: result.data.userid,
          token: result.data.token
        })
      }
      if (userinfo.length) {
        const userinfoJSON = JSON.stringify(userinfo)
        if (!hasSecretWriteToken()) {
          const file = saveUserinfoToFile(userinfo)
          printGreen(`USERINFO saved to ${file}`)
        }
        if (hasSecretWriteToken()) {
          try {
            setRepoSecret("USERINFO", userinfoJSON)
            printGreen("secret <USERINFO> 更改成功")
          } catch (error) {
            printRed("自动写入 secret <USERINFO> 出错")
            console.dir(sanitizeForLog({ message: error.message }), { depth: null })
            if (shouldPrintSensitiveValue()) {
              printYellow("已按显式配置输出 USERINFO；请用完后删除 Actions 日志")
              printBlue(userinfoJSON)
            } else {
              printYellow("为避免泄露 token，默认不在日志输出 USERINFO")
              printYellow("如必须手动复制，请重新运行并将 print_userinfo 选择为 是")
            }
          }
        } else {
          if (shouldPrintSensitiveValue()) {
            printGreen("登录信息如下，把它添加到secret USERINFO 即可")
            printYellow("注意：日志包含登录 token，请用完后删除 Actions 日志")
            printBlue(userinfoJSON)
          } else {
            printYellow("PAT/GH_TOKEN 未配置，无法自动写入 secret <USERINFO>")
            printYellow("为避免泄露 token，默认不在日志输出 USERINFO")
            printYellow("如必须手动复制，请重新运行并将 print_userinfo 选择为 是")
          }
        }
      }
    } else if (result.error_code === 34175) {
      throw new Error("暂不支持多账号绑定手机登录")
    } else {
      printRed("响应内容")
      console.dir(summarizeResponse(result), { depth: null })
      throw new Error("登录失败！请检查")
    }
  } finally {
    close_api(api)
  }

  if (api.killed) {
    process.exit(0)
  }
}

login()
