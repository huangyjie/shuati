# 刷题小程序 (shuati) - 计算机知识在线学习平台

![Logo](https://api.hsbogk.icu/mini-programs/images/logo.png)

## 项目概述

应知刷题小程序是一款专注于计算机知识学习的微信小程序，提供多种练习模式、AI辅助学习、社区交流等功能，帮助用户高效备考计算机相关考试。目前包含硬件、软件、网络、信创等多个知识领域的题目，支持顺序刷题、随机抽题、章节练习、模拟考试等多种学习模式。

**当前版本**：2.6.0

## 主要功能

### 📝 题目练习
- **顺序刷题**：按照预设顺序练习，支持断点续练
- **随机抽题**：从题库随机抽取试题进行练习
- **章节练习**：按知识点分类进行专项训练
- **错题本**：自动收集错题，支持专项练习和云端同步
- **收藏夹**：可收藏重要题目，支持云端同步
- **答题闯关**：关卡式学习，难度逐级递增
- **自我挑战**：自定义题目数量、时长的专项练习

### 🧠 AI辅助学习
- **AI辅助刷题**：AI实时解析题目，提供解题思路和知识扩展
- **学习助手**：支持深度问答，解决学习疑难
- **题目分析**：对错题进行智能分析，总结知识短板

### 📊 考试模拟
- **模拟考试**：模拟真实考试环境，限时答题
- **万维调考**：定期更新的模拟考试试卷
- **成绩分析**：考试后提供详细的成绩分析报告

### 🏆 积分与排名
- **积分系统**：完成各类学习任务获取积分
- **段位晋升**：积分达到一定数量可晋升段位
- **排行榜**：支持综合、答题数量、准确率等多维度排名

### 👥 社区功能
- **交流室**：用户间实时交流，讨论学习问题
- **QQ交流群**：提供多个QQ群供用户交流

### 📚 资源共享
- **资源中心**：分享考试资料、政策文件等学习资源

## 项目结构

```
├── app.js                 # 小程序入口文件
├── app.json               # 小程序全局配置
├── app.wxss               # 小程序全局样式
├── cloudfunctions/        # 云函数目录
│   ├── chatWithAI/        # AI聊天功能云函数
│   └── ...
├── config/                # 配置文件目录
│   ├── examConfig.js      # 顺序刷题配置
│   └── wanwei.js          # 万维调考配置
├── packageAdmin/          # 管理员功能分包
│   ├── pages/
│   │   ├── developer-management/    # 开发者管理
│   │   ├── illegal-accounts/        # 违规账号管理
│   │   ├── logs-management/         # 日志管理
│   │   ├── qq-groups-management/    # QQ群管理
│   │   ├── resource-management/     # 资源管理
│   │   ├── reward-management/       # 奖励管理
│   │   ├── settings/                # 系统设置
│   │   ├── sponsor-management/      # 赞助者管理
│   │   ├── statistics/              # 数据统计
│   │   └── user-management/         # 用户管理
├── packageExam/           # 考试功能分包
│   ├── pages/
│   │   ├── ai-practice/             # AI辅助刷题
│   │   ├── answer/                  # 顺序刷题答题页
│   │   ├── breakthrough-practice/   # 闯关答题
│   │   ├── chapter-answer/          # 章节练习答题页
│   │   ├── exam-result/             # 考试结果
│   │   ├── mock-exam/               # 模拟考试
│   │   ├── random-practice/         # 随机抽题
│   │   ├── wanwei-answer/           # 万维调考答题页
│   │   └── wrong/                   # 错题本
├── pages/                 # 主包页面
│   ├── admin/                       # 管理员入口
│   ├── ai-chat/                     # 学习助手
│   ├── breakthrough/                # 闯关主页
│   ├── challenge/                   # 自我挑战
│   ├── chapters/                    # 章节练习
│   ├── chat-room/                   # 交流室
│   ├── comprehensive/               # 个人中心
│   ├── index/                       # 首页
│   ├── mock/                        # 模拟考试主页
│   ├── practice/                    # 顺序刷题主页
│   ├── profile/                     # 关于页面
│   ├── ranking/                     # 排行榜
│   ├── resources/                   # 资源中心
│   ├── search/                      # 搜索页面
│   ├── sponsors/                    # 赞助者名单
│   └── wrong/                       # 错题本
└── project.config.json    # 项目配置文件
```

## 安装与使用

### 开发环境要求
- 微信开发者工具 (最新版本)
- Node.js (建议 14.0.0 及以上)

### 安装步骤

1. 克隆项目到本地:
```bash
git clone https://github.com/yourusername/shuati.git
cd shuati
```

2. 使用微信开发者工具打开项目文件夹

3. 配置云开发环境:
   - 在微信开发者工具中开通云开发
   - 将 `app.js` 中的 `env` 替换为你自己的云环境ID:
   ```javascript
   wx.cloud.init({
     env: 'your-cloud-env-id',
     traceUser: true
   })
   ```
   - 在 `app.js` 中的`iconBaseUrl`设置你的全局图标服务器地址
 ```javascript
    globalData: {
        StatusBar: 0,
        darkMode: false,
        currentVersion: '2.6.0',  // 当前版本号
        nextVersion: '3.0',        // 下一版本号
        iconBaseUrl: 'https://your-icon-base-url' // 统一的图标路径服务器地址
  }
  ```
4. 部署云函数:
   - 在微信开发者工具中右键点击 `cloudfunctions` 文件夹下的每个云函数
   - 选择"上传并部署"

5. 导入数据库集合:
   项目需要以下主要集合:
   - questions (主题库)
   - hardware (硬件题库)
   - Software (软件题库)
   - Internet (网络题库)
   - Xinchuang (信创题库)
   - users (用户信息)
   - user_wrong_questions (错题本)
   - user_favorite_questions (收藏题目)
   - 其他集合 (详见下文数据库设计部分)

## 自定义配置

### 题库配置
在 `config/examConfig.js` 文件中可以配置顺序刷题的题库:

```javascript
module.exports = {
  examList: [
    {
      id: 1,
      title: "顺序刷题一",
      description: "计算机基础知识第1-50题",
      questionCount: 50
    },
    // 更多题库...
  ]
}
```

### 万维调考配置
在 `config/wanwei.js` 文件中可以配置万维调考的试卷:

```javascript
module.exports = {
  examList: [
    {
      id: 1,
      title: "万维调考第一次2024",
      description: "万维调考第一次",
      questionCount: 50
    },
    // 更多试卷...
  ]
}
```

## AI功能配置

### AI接口配置
在 `cloudfunctions/chatWithAI/index.js` 中配置AI接口:

```javascript
// 云函数AI接口配置
const DEEPSEEK_API_KEY = 'your-api-key';         // DeepSeek AI接口密钥
const BASE_URL = 'https://api.deepseek.com/v1';  // DeepSeek API地址

// KIMI API配置
const KIMI_API_KEY = 'your-kimi-api-key';        // Moonshot KIMI接口密钥
const KIMI_URL = 'https://kimi.moonshot.cn/api/chat'; // KIMI API地址
```

### AI学习助手配置 (pages/ai-chat)

#### 页面配置 (ai-chat.json)
```json
{
  "navigationBarTitleText": "AI学习助手",
  "navigationBarBackgroundColor": "#4A90E2",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "mp-icon": "weui-miniprogram/icon/icon"
  }
}
```

#### 页面布局 (ai-chat.wxml)
```html
<view class="container">
  <!-- 聊天消息列表 -->
  <scroll-view scroll-y class="chat-list" scroll-into-view="{{scrollToMessage}}" scroll-with-animation>
    <block wx:for="{{messageList}}" wx:key="index">
      <view id="msg-{{index}}" class="message-item {{item.role === 'user' ? 'user-message' : 'ai-message'}}">
        <view class="avatar">
          <image src="{{item.role === 'user' ? userAvatar : aiAvatar}}"></image>
        </view>
        <view class="message-content">
          <text>{{item.content}}</text>
        </view>
      </view>
    </block>
    <!-- 加载中提示 -->
    <view class="message-item ai-message" wx:if="{{loading}}">
      <view class="avatar">
        <image src="{{aiAvatar}}"></image>
      </view>
      <view class="message-content loading">
        <text>思考中...</text>
      </view>
    </view>
  </scroll-view>

  <!-- 底部输入框 -->
  <view class="input-area">
    <view class="input-wrapper">
      <input type="text" value="{{inputValue}}" bindinput="onInput" placeholder="请输入问题..." confirm-type="send" bindconfirm="sendMessage"/>
      <button class="send-btn" bindtap="sendMessage" disabled="{{loading || !inputValue}}">发送</button>
    </view>
    <view class="model-selector">
      <text>模型选择: </text>
      <radio-group bindchange="onModelChange">
        <label class="radio">
          <radio value="kimi" checked="{{currentModel === 'kimi'}}"/>Kimi
        </label>
        <label class="radio">
          <radio value="zhinao" checked="{{currentModel === 'zhinao'}}"/>智脑
        </label>
      </radio-group>
    </view>
  </view>
</view>
```

#### 页面逻辑 (ai-chat.js)
```javascript
Page({
  data: {
    inputValue: "",
    messageList: [],
    loading: false,
    userAvatar: "/images/user-avatar.png",
    aiAvatar: "/images/ai-avatar.png",
    scrollToMessage: "",
    currentModel: "kimi"  // 默认模型
  },

  onLoad: function (options) {
    // 初始化页面时的欢迎消息
    this.setData({
      messageList: [{
        role: 'assistant',
        content: '你好，我是AI学习助手，有什么关于计算机知识的问题都可以问我！'
      }]
    });
  },

  // 切换模型
  onModelChange: function (e) {
    this.setData({
      currentModel: e.detail.value
    });
  },

  // 发送消息
  sendMessage: function () {
    if (this.data.loading || !this.data.inputValue) return;

    const userMessage = {
      role: 'user',
      content: this.data.inputValue
    };

    let newMessageList = [...this.data.messageList, userMessage];
    
    // 清空输入框并显示加载状态
    this.setData({
      messageList: newMessageList,
      inputValue: "",
      loading: true,
      scrollToMessage: `msg-${newMessageList.length - 1}`
    });

    // 调用云函数获取AI回复
    wx.cloud.callFunction({
      name: 'chatWithAI',
      data: {
        prompt: userMessage.content,
        model: this.data.currentModel,
        systemPrompt: "你是一个专业的计算机科学学习助手，擅长解释各种计算机科学概念和解答相关问题。"
      },
      success: res => {
        if (res.result && res.result.success) {
          const aiResponse = {
            role: 'assistant',
            content: res.result.response
          };
          
          newMessageList = [...this.data.messageList, aiResponse];
          this.setData({
            messageList: newMessageList,
            scrollToMessage: `msg-${newMessageList.length - 1}`
          });
        } else {
          // 处理返回错误
          const errorMessage = {
            role: 'assistant',
            content: '抱歉，AI回复出现错误，请稍后再试。'
          };
          
          newMessageList = [...this.data.messageList, errorMessage];
          this.setData({
            messageList: newMessageList,
            scrollToMessage: `msg-${newMessageList.length - 1}`
          });
          
          console.error('AI回复错误:', res);
        }
      },
      fail: err => {
        // 处理调用失败
        const errorMessage = {
          role: 'assistant',
          content: '网络错误，请检查网络连接后重试。'
        };
        
        newMessageList = [...this.data.messageList, errorMessage];
        this.setData({
          messageList: newMessageList,
          scrollToMessage: `msg-${newMessageList.length - 1}`
        });
        
        console.error('调用云函数失败:', err);
      },
      complete: () => {
        this.setData({
          loading: false
        });
      }
    });
  }
});
```

### AI辅助刷题配置 (packageExam/pages/ai-practice)

#### 页面配置 (ai-practice.json)
```json
{
  "navigationBarTitleText": "AI辅助刷题",
  "navigationBarBackgroundColor": "#4A90E2",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "mp-dialog": "weui-miniprogram/dialog/dialog"
  }
}
```

#### 页面布局 (ai-practice.wxml)
```html
<view class="container">
  <!-- 题目内容区域 -->
  <view class="question-container">
    <view class="question-title">{{currentQuestion.title}}</view>
    <view class="options-container">
      <!-- 选项列表 -->
      <view wx:for="{{options}}" wx:key="index" class="option-item {{selectedOption === item.key ? (item.key === currentQuestion.answer ? 'correct' : 'wrong') : ''}} {{showAnswer && item.key === currentQuestion.answer ? 'correct' : ''}}" bindtap="selectOption" data-option="{{item.key}}">
        <text class="option-key">{{item.key}}.</text>
        <text class="option-content">{{item.value}}</text>
      </view>
    </view>

    <!-- 答案与解析 -->
    <view class="answer-container" wx:if="{{showAnswer}}">
      <view class="answer-label">正确答案: {{currentQuestion.answer}}</view>
      <view class="analysis" wx:if="{{currentQuestion.analysis}}">
        <view class="analysis-title">官方解析:</view>
        <view class="analysis-content">{{currentQuestion.analysis}}</view>
      </view>
      
      <!-- AI解析区域 -->
      <view class="ai-analysis">
        <view class="ai-title">
          <text>AI智能解析</text>
          <view class="ai-model-select">
            <text>模型: </text>
            <picker bindchange="changeAIModel" value="{{aiModelIndex}}" range="{{aiModels}}">
              <view class="picker">{{aiModels[aiModelIndex]}}</view>
            </picker>
          </view>
        </view>
        
        <view class="ai-content">
          <view wx:if="{{aiLoading}}" class="ai-loading">
            <text>AI正在思考中...</text>
          </view>
          <view wx:else class="ai-response">
            <text>{{aiAnalysis || "点击下方按钮获取AI解析"}}</text>
          </view>
        </view>
        
        <button class="ai-button" bindtap="getAIAnalysis" disabled="{{aiLoading}}">
          {{aiAnalysis ? "重新解析" : "获取AI解析"}}
        </button>
      </view>
    </view>
  </view>

  <!-- 底部操作栏 -->
  <view class="action-bar">
    <button class="action-button prev" bindtap="prevQuestion" disabled="{{currentIndex === 0}}">上一题</button>
    <button class="action-button check" bindtap="checkAnswer" wx:if="{{!showAnswer}}">查看答案</button>
    <button class="action-button next" bindtap="nextQuestion" disabled="{{currentIndex === questions.length - 1}}">下一题</button>
  </view>
</view>
```

#### 页面逻辑 (ai-practice.js)
```javascript
Page({
  data: {
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    options: [],
    selectedOption: "",
    showAnswer: false,
    aiAnalysis: "",
    aiLoading: false,
    aiModels: ["Kimi", "智脑"],
    aiModelIndex: 0
  },
  
  onLoad: function(options) {
    // 加载题目数据
    // ...省略部分代码...
  },

  // 切换AI模型
  changeAIModel: function(e) {
    this.setData({
      aiModelIndex: e.detail.value,
      aiAnalysis: "" // 清空当前解析
    });
  },

  // 获取AI解析
  getAIAnalysis: function() {
    const question = this.data.currentQuestion;
    if (!question) return;
    
    // 根据题目类型构建提示词
    let prompt = `请解析以下计算机知识题目:\n\n问题: ${question.title}\n`;
    prompt += `选项A: ${question.optionA}\n选项B: ${question.optionB}\n`;
    if (question.optionC) prompt += `选项C: ${question.optionC}\n`;
    if (question.optionD) prompt += `选项D: ${question.optionD}\n`;
    prompt += `正确答案: ${question.answer}\n\n`;
    prompt += `请提供详细解析，说明为什么正确答案是${question.answer}，以及其他选项错在哪里。`;
    
    // 设置加载状态
    this.setData({
      aiLoading: true,
      aiAnalysis: ""
    });
    
    // 调用云函数获取AI解析
    wx.cloud.callFunction({
      name: 'chatWithAI',
      data: {
        prompt: prompt,
        model: this.data.aiModelIndex === 0 ? 'kimi' : 'zhinao',
        systemPrompt: "你是一位计算机科学专家，擅长解析计算机相关题目，提供详细、准确的解析和知识扩展。"
      },
      success: res => {
        if (res.result && res.result.success) {
          this.setData({
            aiAnalysis: res.result.response
          });
        } else {
          this.setData({
            aiAnalysis: "AI解析获取失败，请稍后重试。"
          });
        }
      },
      fail: err => {
        this.setData({
          aiAnalysis: "网络错误，请检查网络连接。"
        });
        console.error('调用AI解析失败:', err);
      },
      complete: () => {
        this.setData({
          aiLoading: false
        });
      }
    });
  }
});
```

## 数据库集合设计

### 题库相关集合
- **questions** - 主题库 (28059条记录)
- **hardware** - 硬件题库 (3658条)
- **Software** - 软件题库 (924条)
- **Internet** - 网络题库 (1969条)
- **Xinchuang** - 信创题库 (1036条)
- **Base** - 基础题库 (2862条)
- **wanwei** - 万维题库 (800条)
- **mockExams** - 模拟考试题库 (427条)

### 用户数据相关集合
- **users** - 用户信息 (953条)
- **user_favorite_questions** - 用户收藏题目
- **user_wrong_questions** - 用户错题本
- **user_breakthrough** - 用户闯关记录
- **user_experience** - 用户经验值

### 答题记录相关集合
- **completedPapers** - 已完成试卷
- **dailyPoints** - 每日积分
- **dailyRecords** - 每日答题记录
- **signInRecords** - 签到记录

### 社区与奖励相关集合
- **reward_records** - 奖励记录
- **reward_settings** - 奖励配置
- **red_packets_1** - 红包记录
- **qq_groups** - QQ群信息
- **chat_messages** - 聊天消息
- **chat_settings** - 聊天配置

### 管理相关集合
- **developers** - 开发者信息
- **sponsor** - 赞助者信息
- **announcements** - 系统公告
- **resources** - 资源管理
- **settings** - 系统设置
- **feedback** - 用户反馈

## 云函数接口

### chatWithAI
AI聊天功能云函数，用于与AI模型进行对话。

**参数:**
```javascript
{
  prompt: "用户提问内容",
  model: "kimi", // 可选值: kimi, zhinao
  systemPrompt: "系统提示词"
}
```

**返回:**
```javascript
{
  success: true,
  response: "AI回复内容"
}
```

## 微信小程序接口

### 登录接口
```javascript
// 用户登录
wx.cloud.callFunction({
  name: 'login',
  data: {},
  success: res => {
    const openid = res.result.openid
    // 处理登录逻辑
  },
  fail: err => {
    console.error('登录失败', err)
  }
})
```

### 题目获取接口
```javascript
// 获取题目列表
wx.cloud.database().collection('questions')
  .where({
    category: 'hardware' // 筛选条件
  })
  .limit(50) // 限制返回数量
  .get()
  .then(res => {
    const questions = res.data
    // 处理题目数据
  })
  .catch(err => {
    console.error('获取题目失败', err)
  })
```

## 应用场景示例

### 场景一：日常刷题
1. 用户打开小程序首页
2. 选择"顺序刷题"或"随机抽题"
3. 系统加载题目，用户开始答题
4. 答题完成后查看解析，错题自动收集到错题本

### 场景二：考前突击
1. 用户进入"模拟考试"页面
2. 选择一份模拟试卷开始考试
3. 限时完成所有题目
4. 系统评分并展示详细的答题分析
5. 用户可查看错题并使用AI助手进行讲解

### 场景三：AI辅助学习
1. 用户进入"AI学习助手"页面
2. 输入计算机相关问题
3. 选择合适的AI模型(kimi或智脑)
4. 获取AI详细解答和扩展知识
5. 继续提问或返回学习

## 致谢

- 感谢所有对项目做出贡献的开发者
- 感谢所有赞助支持本项目的用户
- 感谢DeepSeek和Moonshot AI提供AI接口支持

## 版权与许可

本项目采用 [MIT 许可证](LICENSE)。

## 联系方式

- QQ交流群: 1029092798
- 开发者: 小黄学长

---

欢迎贡献代码或提出建议，共同改进刷题宝，帮助更多同学学习计算机知识！
