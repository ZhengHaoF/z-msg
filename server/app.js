// 导入express模块
var express = require('express')
var path = require('path')
// 创建一个express实例
var app = express();

// 导入nodejs-websocket模块
const ws = require('nodejs-websocket')

//  设定使用的静态资源路径（前端构建产物）
app.use('/', express.static(path.join(__dirname, '../web/dist')))

// // 执行app的get请求处理 ，处理访问根目录下的请求
// app.get('/', function (req, res) {
//     res.send('Hello World');
// })


// 执行websocket处理连接方法
let wsServer = ws.createServer(connection => {
    console.log("当前连接数：" + wsServer.connections.length)
    // connection.sendText("连接成功，房间号:" + connection.key)
    let data = {
        type: "info",
        msg: "连接成功",
        sessionCode: connection.key,
    }
    connection.sendText(JSON.stringify(data))
    //处理客户端发送过来的消息
    connection.on("text", function (data) {
        let msgInfo = JSON.parse(data);
        // console.log("接收到的客户端消息:", msgInfo);
        // connection.sendText("服务器端返回数据:"+data)
        try {
            wsServer.connections.forEach((item, index) => {
                if (item.key === msgInfo['sessionCode']) {
                    let data = {
                        type: "msg",
                        roomName: msgInfo['roomName'],
                        msg: msgInfo['msgCode'],
                    }
                    item.sendText(JSON.stringify(data))
                }
            })
        } catch (e) {
            console.log(e)
        }

    })
    //监听关闭
    connection.on("close", function (code, reason) {
        console.log("客户端连接关闭")
    })
    //监听异常
    connection.on("error", () => {
        console.log('服务异常关闭...')
    })
}).listen(process.env.WS_PORT || 3001)

// 创建web服务，设定端口号和ip地址
var server = app.listen(process.env.PORT || 8081, function () {
    var host = server.address()['address']
    var port = server.address()['port']
    console.log("应用实例，访问地址为 http://%s:%s", host, port)
})
