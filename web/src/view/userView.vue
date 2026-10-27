<template>

  <div class="box">
    <a-row style="height: 100%">
      <a-col :lg="7" :md="7" :sm="24">
        <div class="room-list">
          <h2>
            房间列表
          </h2>
          <div style="padding-bottom: 20px">
            我的会话码：{{ myInfo.sessionCode }}
          </div>
          <br>
          <div :class="{'room-options':true,'active':nowRoom['roomName'] === '世界房'}" @click="checkoutWord">
            世界房
          </div>
          <div v-for="(item,index) in roomList"
               :class="{'room-options':true,'active':nowRoom['roomName'] === item['roomName']}"
               @click="checkoutRoom(index)">
            <div>
              <div style="height: 50px;">
                <div style="float: left">
                  {{ item['roomName'] }}
                </div>
                <div style="float: right;">
                  <a-row>
                    <a-col :span="12">
                      <a-button danger shape="circle" type="primary"
                                @click="delRoom(index)">
                        <template #icon>
                          <DeleteOutlined/>
                        </template>
                      </a-button>
                    </a-col>
                    <a-col :span="12">
                      <a-button shape="circle"  type="primary" @click="shareRoom(index)">
                        <template #icon>
                          <ShareAltOutlined/>
                        </template>
                      </a-button>
                    </a-col>
                  </a-row>
                </div>
              </div>
              <div style="padding-top: 10px;width: 100%">
                <a-form>
                  <a-form-item label="会话码">
                    <a-input v-model:value="item['sessionCode']"
                             @change="changeRoomCode(index,item['sessionCode'])"></a-input>
                  </a-form-item>
                </a-form>
              </div>
            </div>
          </div>
          <div>
            <a-button type="primary" @click="addRoom">
              创建房间
            </a-button>
            <a-button @click="importRoom">
              一键导入对方房间
            </a-button>
          </div>
        </div>
      </a-col>
      <a-col :lg="17" :md="17" :sm="24">
        <div class="msg-box">
          <div class="msg-title">
            {{ nowRoom['roomName'] }}
          </div>
          <div class="msg-body">
            <div v-for="(item,index) in nowRoom['msgInfo']"
                 :class="{'content-box':true,'get':item['type']==='get','send':item['type']==='send'}">
              <div class="text">{{ item['msg'] }}</div>
            </div>

          </div>
          <div class="msg-seng-box">
            <a-input v-model:value="msgText" @keydown.enter="sendMsg">

            </a-input>
            <a-button type="primary" @click="sendMsg" style="margin-left: 20px">
              发送
            </a-button>
          </div>

        </div>
      </a-col>
    </a-row>
  </div>
  <a-modal v-model:visible="addModal" title="添加房间" @ok="addOk">
    <a-form :label-col="{style: { width: '100px' }}">
      <a-form-item label="房间名">
        <a-input v-model:value="addForm.roomName" type="text"></a-input>
      </a-form-item>
      <a-form-item label="对方会话码">
        <a-input v-model:value="addForm.sessionCode" type="text"></a-input>
      </a-form-item>
      <a-form-item label="双方约定密码">
        <a-input v-model:value="addForm.roomKey" type="text"></a-input>
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal v-model:visible="importRoomModal" title="导入房间" @ok="importRoomOk">
    <a-form :label-col="{style: { width: '100px' }}">
      <a-form-item label="导入分享码">
        <a-input v-model:value="importRoomCode" type="text"></a-input>
      </a-form-item>
      <a-form-item label="双方约定密码">
        <a-input v-model:value="importRoomKey"></a-input>
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal v-model:visible="shareCodeModal" title="分享" @ok="shareRoomOk">
    <a-form :label-col="{style: { width: '100px' }}">
      <a-form-item label="分享码">
        <a-input v-model:value="shareCode"></a-input>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import {DeleteOutlined, ShareAltOutlined} from "@ant-design/icons-vue";
import {onMounted, reactive, ref} from "vue";
import {message} from "ant-design-vue";
import {decrypt, encrypt} from "../tool/tool.js";
import CryptoJS from 'crypto-js'
//添加房间
const addModal = ref(false);
//导入房间
const importRoomModal = ref(false)
const msgText = ref("");
let addForm = reactive({
  roomName: "",
  sessionCode: "",
  roomKey: ""
})
//添加房间
const addOk = function () {
  if (roomList.filter((item) => {
    return item['roomName'] === addForm.roomName
  }).length === 0) {
    roomList.push(
        {
          "roomName": addForm.roomName,
          "sessionCode": addForm.sessionCode,
          "roomKey": addForm.roomKey,
          "msgInfo": []
        })
    addForm.roomName = ""
    addForm.sessionCode = ""
    addForm.roomKey = ""
    addModal.value = false;
  } else {
    message.warn("房间已经存在");
  }


}
//房间列表
const roomList = reactive([])
//当前房间
let nowRoom = reactive({
  //房价名
  roomName: "",
  //聊天记录
  msgInfo: [],
  //对方会话码
  sessionCode: "",
  //双方约定密码
  roomKey: "",
})
//我的信息
let myInfo = reactive({
  sessionCode: ""
})

/**
 * 添加房间
 */
const addRoom = function () {
  addModal.value = true;
}


//房间分享码
const importRoomCode = ref("");
const importRoomKey = ref("");
/**
 * 导入对方房间
 */
const importRoom = function () {
  importRoomModal.value = true;
}
/**
 * 导入房间
 */
const importRoomOk = function () {
  let roomCodeInfo = importRoomCode.value.split("||");
  if (roomList.filter((item) => {
    return item['roomName'] === roomCodeInfo[0]
  }).length === 0) {
    if (CryptoJS.MD5(roomCodeInfo[0] + roomCodeInfo[1] + importRoomKey.value).toString() === roomCodeInfo[2]) {
      roomList.push(
          {
            "roomName": roomCodeInfo[0],
            "sessionCode": roomCodeInfo[1],
            "roomKey": importRoomKey.value,
            "msgInfo": []
          })
      importRoomModal.value = false;
      importRoomCode.value = "";
      importRoomKey.value = "";
    } else {
      message.warn("参数不正确")
    }
  } else {
    message.warn("房间已经存在");
  }

}


/**
 * 删除房间
 * @param index
 */

const delRoom = function (index) {
  if (nowRoom.roomName === roomList[index]['roomName']) {
    nowRoom.roomName = "";
    nowRoom.msgInfo = [];
    nowRoom.sessionCode = "";
    nowRoom.roomKey = "";
  }
  roomList.splice(index, 1)
}

const shareCodeModal = ref(false);
const shareCode = ref("");

/**
 * 分享房间
 * @param index
 */

const shareRoom = function (index) {
  shareCodeModal.value = true;
  shareCode.value = roomList[index]['roomName'] + "||" + myInfo['sessionCode'] + "||" + CryptoJS.MD5(roomList[index]['roomName'] + myInfo['sessionCode'] + roomList[index]['roomKey']).toString();
  //房间名||会话码
}

const changeRoomCode = function (index, code) {
  roomList[index]['sessionCode'] = code;
  // nowRoom.sessionCode = code;
  checkoutRoom(index)
}

const shareRoomOk = function () {
  shareCodeModal.value = false;
}
/**
 * 切换房间
 * @param index
 */
const checkoutRoom = function (index) {
  message.success("房间切换：" + roomList[index]['roomName'])
  nowRoom['roomName'] = roomList[index]['roomName'];
  nowRoom['msgInfo'] = roomList[index]['msgInfo'];
  nowRoom['sessionCode'] = roomList[index]['sessionCode'];
  nowRoom['roomKey'] = roomList[index]['roomKey'];
}
const checkoutWord = function (index) {
  message.info("世界房未开放")
  // nowRoom['roomName'] = "世界房";
}
onMounted(() => {
  initWebSocket();
})
/**
 * 发送信息
 */
const sendMsg = function () {
  if (nowRoom.roomName === "") {
    message.info("未选择房间")
    return 0;
  }
  let data = {
    "sessionCode": nowRoom.sessionCode,
    "roomName": nowRoom.roomName,
    "msgCode": encrypt(msgText.value, nowRoom.roomKey)
  }
  console.log("加密密码：", nowRoom.roomKey)
  console.log("发送数据", data)
  nowRoom.msgInfo.push({
    "type": "send",
    "msg": msgText.value.toString()
  })
  websocket.send(
      // 发送数据
      JSON.stringify(data)
  );
  msgText.value = "";
}
let websocket = reactive(null);
const initWebSocket = function () {
  //初始化weosocket
  const wsuri = "ws://" + location.hostname + ":3001"; //ws地址
  websocket = new WebSocket(wsuri);
  websocket.onopen = websocketonopen;
  websocket.onerror = websocketonerror;
  websocket.onmessage = websocketonmessage;
  websocket.onclose = websocketclose;
}
const websocketonopen = function () {
  message.success("服务器连接成功")
  console.log("WebSocket连接成功");

}
const websocketonerror = function (e) {
  //错误
  // this.initWebSocket()
  console.log("WebSocket连接发生错误");
}
const websocketonmessage = function (e) {
  //数据接收
  var that = this;
  var data = JSON.parse(e.data);
  console.log("接收数据", data);
  if (data['type'] === "info") {
    //收到的是房间信息数据
    myInfo.sessionCode = data['sessionCode'];
    console.log(myInfo.sessionCode)
  } else if (data['type'] === "msg") {
    console.log(nowRoom.roomKey)
    let c = decrypt(data['msg'], nowRoom.roomKey)
    if (c !== "") {
      nowRoom.msgInfo.push({
        "type": "get",
        "msg": c
      })
    }
  }
  //操作处理...
}
const websocketclose = function (e) {
  //关闭
  console.log(JSON.stringify(e));
}
</script>

<style scoped>
.box {
  height: 100%;
  overflow-y: scroll;
}

.room-list {
  width: 100%;
  height: 100%;
  background-color: #e6f7ff;
  padding: 20px;
}

.room-options {
  width: 100%;
  background-color: white;
  min-height: 50px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  font-size: 18px;
  border-radius: 5px;
  margin-bottom: 10px;
  padding: 10px;
  transition: all 0.2s;
  user-select: none;
}


.room-options:hover {
  background-color: #e6f7ff;
  box-shadow: 2px 2px 2px 1px #7dd6ff;
}

.active {
  background-color: #94ddff;
  box-shadow: 2px 2px 2px 1px #7dd6ff;
}

.msg-box {
  padding: 10px;
  height: 100%;
  width: 100%;
}

.msg-title {
  font-size: 24px;
  min-height: 60px;
  font-weight: bolder;
  padding: 20px;
  background-color: #ebf8ff;
  border: 1px solid #7dd6ff;
  border-radius: 5px;

}

.msg-body {
  width: 100%;
  height: 80vh;
  background-color: #f7fdff;
  margin-top: 5px;
  border: 1px solid #7dd6ff;
  border-radius: 5px;
  padding: 20px;
  overflow-x: hidden;
  overflow-y: scroll;

}

.content-box {
  font-size: 18px;
  border-radius: 5px;
  width: 100%;
  float: left;
  padding: 10px;
}

.get .text {
  width: 50%;
  height: 100%;

}

.send .text {
  width: 50%;
  float: right;
  text-align: right;
}


.get {
  background-color: #d9f5ff;
}

.msg-seng-box {
  padding-top: 5px;
  text-align: right;
  width: 100%;
  display: flex;
}

.ant-col {
  width: 100%;
}
</style>
