import { printBlue, printGreen, printMagenta, printRed, printYellow } from "./utils/colorOut.js";
import { hasSecretWriteToken, setRepoSecret } from "./utils/githubSecrets.js";
import { maskDisplayName, maskIdentifier, sanitizeForLog, summarizeResponse } from "./utils/safeLog.js";
import { loadUserinfo, saveUserinfoToFile } from "./utils/userinfoStore.js";
import { close_api, delay, send, startService } from "./utils/utils.js";

async function main() {
  const refreshUserinfo = []
  let needRefresh = false
  const userinfo = loadUserinfo()

  // 启动服务
  const api = startService()
  await delay(2000)

  const today = new Date();
  // 服务器时间比国内慢8小时
  today.setTime(today.getTime() + 8 * 60 * 60 * 1000)
  //日期
  const DD = String(today.getDate()).padStart(2, '0'); // 获取日
  const MM = String(today.getMonth() + 1).padStart(2, '0'); //获取月份，1 月为 0
  const yyyy = today.getFullYear(); // 获取年份
  const date = yyyy + '-' + MM + '-' + DD

  const errorMsg = {}
  try {
    // 开始签到
    for (const user of userinfo) {
      const headers = { 'cookie': 'token=' + user.token + '; userid=' + user.userid }
      // console.log(headers)
      const userDetail = await send(`/user/detail?timestrap=${Date.now()}`, "GET", headers)
      if (userDetail?.data?.nickname == null) {
        const safeUserId = maskIdentifier(user.userid)
        printRed(`token过期或账号不存在, userid: ${safeUserId}`)
        errorMsg[safeUserId] = {
          msg: `token过期或账号不存在, userid: ${safeUserId}`,
          data: summarizeResponse(userDetail)
        }
        continue
      }
      const safeNickname = maskDisplayName(userDetail.data.nickname)
      printMagenta(`账号 ${safeNickname} 开始领取VIP...`)

      // 周日刷新token
      if (today.getDay() == 0) {
        const refreshToken = await send(`/login/token?timestrap=${Date.now()}`, "POST", headers)
        if (refreshToken?.status == 1) {
          if (refreshToken?.data?.token !== user.token) {
            needRefresh = true
            printYellow(`账号 ${safeNickname} 需要刷新token`)
            user.token = refreshToken.data.token
          }
        }
        refreshUserinfo.push(user)
      }

      // 开始听歌
      printYellow(`开始听歌领取VIP...`)
      // 听歌获取vip
      const listen = await send(`/youth/listen/song?timestrap=${Date.now()}`, "GET", headers)

      if (listen.status === 1) {
        printGreen("听歌领取成功")
      } else if (listen.error_code === 130012) {
        printGreen("今日已领取")
      } else {
        errorMsg[`${safeNickname} listen`] = summarizeResponse(listen)
        printRed("听歌领取失败")
      }

      printYellow("开始领取VIP...")
      for (let i = 1; i <= 8; i++) {
        // ad获取vip
        const ad = await send(`/youth/vip?timestrap=${Date.now()}`, "GET", headers)
        // 签到出现问题
        // errorMsg[`${safeNickname} ad${i}`] = summarizeResponse(ad)
        if (ad.status === 1) {
          printGreen(`第${i}次领取成功`)
          if (i != 8) {
            await delay(30 * 1000)
          }
        } else if (ad.error_code === 30002) {
          printGreen("今天次数已用光")
          break
        } else {
          printRed(`第${i}次领取失败`)
          // console.dir(ad, { depth: null })
          errorMsg[`${safeNickname} ad`] = summarizeResponse(ad)
          break
        }
      }

      const vip_details = await send(`/user/vip/detail?timestrap=${Date.now()}`, "GET", headers)
      if (vip_details.status === 1) {
        printBlue(`今天是：${date}`)
        printBlue(`VIP到期时间：${vip_details.data.busi_vip[0].vip_end_time}\n`)
      } else {
        printRed("获取失败\n")
        errorMsg[`${safeNickname} vip_details`] = summarizeResponse(vip_details)
      }
    }

  } finally {
    close_api(api)
  }

  // 更新secret <USERINFO>
  if (refreshUserinfo.length > 0 && needRefresh) {

    if (hasSecretWriteToken()) {
      const userinfoJSON = JSON.stringify(refreshUserinfo)
      try {
        setRepoSecret("USERINFO", userinfoJSON)
        printGreen("secret <USERINFO> token刷新成功")
      } catch (error) {
        printRed("token刷新失败")
        console.dir(sanitizeForLog({ message: error.message }), { depth: null })
        throw new Error("secret <USERINFO> token刷新失败")
      }
    } else {
      const file = saveUserinfoToFile(refreshUserinfo)
      printGreen(`USERINFO saved to ${file}`)
    }

  }

  if (Object.keys(errorMsg).length > 0) {
    printRed("异常信息如下:")
    console.dir(sanitizeForLog(errorMsg), { depth: null })
    throw new Error("领取异常")
  }

  if (api.killed) {
    process.exit(0)
  }
}

main()
