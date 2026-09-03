import { spawn } from 'child_process'

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

// 运行api服务
function startService() {

  let api = spawn("npm", ["run", "apiService"])

  api.stdout.on('data', data => {
    console.log(`${data}`)
  })

  api.on('close', code => {
    console.log(`子进程退出`)
  })
  api.stderr.on('data', data => {
    // npm warn 不代表服务启动失败；这里仅输出，避免提前抛错杀掉登录流程
    console.log(`${data}`)
  })
  return api

}

// 关闭api服务
function close_api(api) {
  api.kill()
}

// 发送请求：青龙里 API 子进程启动有时超过 2 秒，做重试避免 ECONNREFUSED
async function send(path, method, headers) {
  let lastError
  for (let i = 0; i < 30; i++) {
    try {
      const result = await fetch("http://127.0.0.1:3000" + path, {
        method: method,
        headers: headers
      }).then(r => r.json())
      // console.log(result)
      return result
    } catch (error) {
      lastError = error
      await delay(1000)
    }
  }
  throw lastError
}

export { delay, startService, close_api, send }
