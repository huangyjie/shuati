// packageExam/pages/ai-practice/ai-practice.js
const app = getApp()

// 题库集合配置
const COLLECTIONS = {
  'Base': '进制题库',
  'Internet': '网络题库',
  'Software': '软件题库',
  'Xinchuang': '信创题库',
  'hardware': '硬件题库',
  'wanwei': '万维题库'
};

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    currentQuestion: null,
    userAnswer: '',
    showAnswer: false,
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    isLastQuestion: false,
    isCorrect: false,
    selectedAnswers: {},
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showAnswerCard: false,
    showSettings: false,
    loading: true,
    autoSave: false,
    isLogin: false,
    isFavorite: false,
    favoriteQuestions: [],
    showAIPanel: false,
    messages: [],
    lastMessageId: '',
    isSubmitting: false,
    examId: '',
    apiKey: '输入你的API Key',  // 讯飞星火配置
    // 讯飞星火配置
    xfConfig: {
      appId: 'xxxx', // 替换为你的讯飞开放平台应用ID
      apiSecret: 'xxxx', // 替换为你的讯飞开放平台API Secret
      apiKey: 'xxxx', // 替换为你的讯飞开放平台API Key  
      apiPassword: 'xxx:xxx', // 替换为你的讯飞开放平台API Password
      currentModel: 'kimi'                      // 当前使用的模型,'xunfei'或'kimi'或'zhinao'
    },
    kimiConfig: {
      apiKey: 'sk-xxx' // kimi配置
    },
    zhinaoConfig: {
      apiKey: 'xxx.xxx-xxxx-xxx' // 智脑配置
    },
    volcConfig: {
      apiKey: 'xxx-xxx-xxx-xxx-xxx' // 火山引擎配置
    }
  },

  onLoad() {
    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    if (!authInfo || !authInfo.isLogin || !authInfo.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先在综合页面登录后再答题',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }

    // 获取收藏的题目
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    
    // 生成唯一的考试ID
    const examId = `ai_practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 检查是否已经提交过
    const submitKey = `ai_practice_${examId}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showModal({
        title: '提示',
        content: '本次练习已经提交过了',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/packageExam/pages/exam-result/exam-result?mode=ai-practice'
          });
        }
      });
      return;
    }

    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ 
      userInfo: authInfo.userInfo,
      darkMode,
      examId,
      favoriteQuestions
    });

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });
    
    this.loadQuestions();
  },

  onShow() {
    // 每次页面显示时检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      wx.setNavigationBarColor({
        frontColor: darkMode ? '#ffffff' : '#000000',
        backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
      });
    }
  },

  async loadQuestions() {
    try {
      wx.showLoading({ title: '加载题目...' });
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 从每个集合中随机抽取题目
      let allQuestions = [];
      const questionsPerCollection = 10; // 每个题库抽取10题，总共50题
      
      for (const collection of Object.keys(COLLECTIONS)) {
        try {
          // 获取集合中的题目总数
          const total = (await db.collection(collection).count()).total;
          if (total === 0) continue;

          // 生成随机索引
          const randomIndexes = [];
          while(randomIndexes.length < questionsPerCollection) {
            const randomIndex = Math.floor(Math.random() * total);
            if(!randomIndexes.includes(randomIndex)) {
              randomIndexes.push(randomIndex);
            }
          }

          // 并行获取随机题目
          const promises = randomIndexes.map(index => {
            return db.collection(collection)
              .skip(index)
              .limit(1)
              .get();
          });

          const results = await Promise.all(promises);
          const questions = results
            .map(res => res.data[0])
            .filter(Boolean)
            .map(item => ({
              序号: allQuestions.length + 1,
              title: item.title || item.question || '',
              optionA: item.optionA || item.A || '',
              optionB: item.optionB || item.B || '',
              optionC: item.optionC || item.C || '',
              optionD: item.optionD || item.D || '',
              answer: item.answer || '',
              type: COLLECTIONS[collection],
              source: collection,
              _id: item._id,
              isFavorite: this.data.favoriteQuestions.some(q => q._id === item._id)
            }));

          allQuestions = allQuestions.concat(questions);
        } catch (err) {
          console.error(`从${collection}加载题目失败:`, err);
        }
      }

      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('没有找到题目');
      }

      // 随机打乱题目顺序
      allQuestions = this.shuffleArray(allQuestions);

      this.setData({
        questions: allQuestions,
        currentQuestion: allQuestions[0],
        totalQuestions: allQuestions.length,
        loading: false,
        isFavorite: allQuestions[0].isFavorite
      });

      wx.hideLoading();
    } catch (err) {
      console.error('加载题目失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      wx.hideLoading();
    }
  },

  // 从数组中随机抽取指定数量的元素
  getRandomQuestions(array, count) {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    
    // 随机打乱数组
    while (currentIndex !== 0) {
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    }
    
    // 返回前count个元素
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  // 打乱数组顺序的方法
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  handleOptionTap(e) {
    if (this.data.showAnswer) return;
    
    const option = e.currentTarget.dataset.option;
    const { currentIndex, questions, selectedAnswers } = this.data;
    const currentQuestion = questions[currentIndex];
    
    // 记录答案
    selectedAnswers[currentIndex] = option;
    
    // 判断对错
    const isCorrect = option === currentQuestion.answer;
    
    this.setData({
      selectedAnswers,
      showAnswer: true,
      isCorrect
    });

    // 如果答错了，自动添加到错题本
    if (!isCorrect) {
      this.addToWrongQuestions(currentQuestion, option);
    }

    // 自动下一题
    if (this.data.autoNext && currentIndex < questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    }
  },

  async addToWrongQuestions(question, userAnswer) {
    try {
      const db = wx.cloud.database();
      const openid = wx.getStorageSync('openid');
      
      if (!openid) return;

      await db.collection('wrong-questions').add({
        data: {
          userId: openid,
          questionId: question._id,
          question: question,
          userAnswer: userAnswer,
          correctAnswer: question.answer,
          source: question.source,
          createTime: db.serverDate()
        }
      });
    } catch (err) {
      console.error('保存错题失败:', err);
    }
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      const nextQuestion = this.data.questions[nextIndex];
      
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: nextQuestion,
        showAnswer: false,
        isCorrect: false,
        isFavorite: nextQuestion.isFavorite,
        selectedAnswers: { ...this.data.selectedAnswers }  // 保持已有的答案记录
      });
    }
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      const prevQuestion = this.data.questions[prevIndex];
      
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: prevQuestion,
        showAnswer: false,
        isCorrect: false,
        isFavorite: prevQuestion.isFavorite
      });
    }
  },

  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  toggleAnswerCard() {
    this.setData({
      showAnswerCard: !this.data.showAnswerCard
    });
  },

  toggleAIPanel() {
    this.setData({
      showAIPanel: !this.data.showAIPanel
    });
  },

  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
  },

  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);
    
    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });
  },

  preventBubble() {
    // 阻止冒泡
  },

  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const targetQuestion = this.data.questions[index];
    const isFavorite = this.data.favoriteQuestions.some(q => q._id === targetQuestion._id);
    
    this.setData({
      currentIndex: index,
      currentQuestion: targetQuestion,
      showAnswerCard: false,
      showAnswer: false,
      isCorrect: false,
      isFavorite
    });
  },

  // 提交判分相关方法
  submitExam() {
    if (this.data.isSubmitting) {
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const { questions, selectedAnswers } = this.data;
    const unansweredCount = questions.length - Object.keys(selectedAnswers).length;

    if (unansweredCount > 0) {
      wx.showModal({
        title: '提示',
        content: `还有 ${unansweredCount} 题未作答，确定要交卷吗？`,
        success: (res) => {
          if (res.confirm) {
            this.calculateAndRedirect();
          }
        }
      });
    } else {
      this.calculateAndRedirect();
    }
  },

  async calculateAndRedirect() {
    try {
      if (this.data.isSubmitting) {
        return;
      }

      this.setData({ isSubmitting: true });
      wx.showLoading({ title: '正在提交...' });

      const { questions, selectedAnswers, examId } = this.data;
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;

      // 统计答题结果
      questions.forEach((question, index) => {
        const userAnswer = selectedAnswers[index];
        if (userAnswer) {
          answeredCount++;
          if (userAnswer === question.answer) {
            correctCount++;
          } else {
            wrongCount++;
          }
        }
      });

      // 计算得分 - 每题3分，总分150分
      const score = Math.round((correctCount / questions.length) * 100);

      // 标记为已提交
      const submitKey = `ai_practice_${examId}_submitted`;
      wx.setStorageSync(submitKey, {
        timestamp: Date.now(),
        score,
        correctCount,
        wrongCount,
        answeredCount
      });

      // 更新首页统计数据
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const totalCorrect = wx.getStorageSync('correctCount') || 0;
      
      // 更新总答题数和正确数
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
      wx.setStorageSync('correctCount', totalCorrect + correctCount);

      // 更新错题本
      let existingWrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      
      // 添加错题
      questions.forEach((question, index) => {
        const userAnswer = selectedAnswers[index];
        if (userAnswer && userAnswer !== question.answer) {
          // 构造错题对象
          const wrongQuestion = {
            序号: question.序号 || index + 1,
            title: question.title,
            optionA: question.optionA || question.A,
            optionB: question.optionB || question.B,
            optionC: question.optionC || question.C,
            optionD: question.optionD || question.D,
            answer: question.answer,
            userAnswer: userAnswer,
            type: question.source || 'AI练习',
            addTime: new Date().getTime()
          };
          
          // 检查是否已存在该错题
          const existIndex = existingWrongQuestions.findIndex(q => 
            q.title === question.title && q.type === wrongQuestion.type
          );
          
          if (existIndex === -1) {
            // 如果错题本达到2000题，删除最早的错题
            if (existingWrongQuestions.length >= 2000) {
              existingWrongQuestions.sort((a, b) => a.addTime - b.addTime);
              existingWrongQuestions.shift();
            }
            existingWrongQuestions.push(wrongQuestion);
          }
        }
      });

      // 保存更新后的错题本
      if (wrongCount > 0) {
        wx.setStorageSync('wrongQuestions', existingWrongQuestions);
      }

      // 保存答题数据到本地存储
      const examData = {
        questions: questions.map(q => ({
          title: q.title,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          answer: q.answer,
          source: q.source || 'AI练习'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        mode: 'ai-practice',
        timestamp: Date.now()
      };

      wx.setStorageSync('currentExamData', examData);

      wx.hideLoading();

      // 跳转到结果页面
      wx.redirectTo({
        url: `/packageExam/pages/exam-result/exam-result?` +
             `score=${score}&` +
             `correctCount=${correctCount}&` +
             `wrongCount=${wrongCount}&` +
             `answeredCount=${answeredCount}&` +
             `totalQuestions=${questions.length}&` +
             `mode=ai-practice`
      });
    } catch (err) {
      console.error('提交失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '提交失败',
        icon: 'none',
        duration: 2000
      });
      // 重置提交状态
      this.setData({ isSubmitting: false });
    }
  },

  // 收藏相关方法
  async toggleFavorite() {
    try {
      const { currentQuestion, isFavorite, favoriteQuestions } = this.data;
      
      if (isFavorite) {
        // 取消收藏
        const newFavorites = favoriteQuestions.filter(q => q._id !== currentQuestion._id);
        this.setData({
          favoriteQuestions: newFavorites,
          isFavorite: false
        });
        wx.setStorageSync('favoriteQuestions', newFavorites);
        
        wx.showToast({
          title: '已取消收藏',
          icon: 'success',
          duration: 1500
        });
      } else {
        // 添加收藏
        // 构造收藏题目对象
        const favoriteQuestion = {
          _id: currentQuestion._id,
          title: currentQuestion.title,
          optionA: currentQuestion.optionA,
          optionB: currentQuestion.optionB,
          optionC: currentQuestion.optionC,
          optionD: currentQuestion.optionD,
          answer: currentQuestion.answer,
          type: currentQuestion.type,
          source: currentQuestion.source,
          addTime: new Date().getTime()
        };
        
        // 检查是否已经收藏过
        const isExist = favoriteQuestions.some(q => q._id === currentQuestion._id);
        if (isExist) {
          wx.showToast({
            title: '已经收藏过了',
            icon: 'none',
            duration: 1500
          });
          return;
        }
        
        // 如果收藏数量超过200，删除最早的收藏
        if (favoriteQuestions.length >= 200) {
          favoriteQuestions.sort((a, b) => a.addTime - b.addTime);
          favoriteQuestions.shift();
        }
        
        const newFavorites = [...favoriteQuestions, favoriteQuestion];
        this.setData({
          favoriteQuestions: newFavorites,
          isFavorite: true
        });
        wx.setStorageSync('favoriteQuestions', newFavorites);
        
        wx.showToast({
          title: '收藏成功',
          icon: 'success',
          duration: 1500
        });
      }
      
      // 更新当前题目的收藏状态
      const questions = this.data.questions.map(q => {
        if (q._id === currentQuestion._id) {
          return { ...q, isFavorite: !isFavorite };
        }
        return q;
      });
      
      this.setData({ questions });
      
    } catch (err) {
      console.error('收藏操作失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // AI相关方法
  async askQuestion(e) {
    const type = e.currentTarget.dataset.type;
    const question = this.data.currentQuestion;
    let prompt = '';

    if (type === 'explain') {
      prompt = `作为计算机考试辅导老师，请详细解析这道${question.type}的题目：
题目：${question.title}
选项：
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}

请按教学大纲要求分析：
1. 题型识别与难度定位（基础/进阶/综合应用）
2. 核心考查点与知识图谱关联
3. 选项设计解析：
   - 正确选项特征及依据
   - 典型干扰项设计逻辑
   - 选项间的区分度分析
4. 解题方法论：
   - 问题拆解步骤
   - 关键信息提取技巧
   - 逻辑推理路径
5. 教学重难点突破：
   - 常见理解误区
   - 概念混淆预防
   - 典型错误模式
6. 知识迁移指导：
   - 同类题型识别特征
   - 变式题应对策略
   - 拓展学习建议`;
    } else if (type === 'hint') {
      prompt = `作为计算机考试辅导老师，请给出这道${question.type}题目的解题提示，但不要直接给出答案：
题目：${question.title}
选项：
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}

解析框架：
1. 命题意图分析（考查目标与能力维度）
2. 核心概念精讲（相关原理图示化说明）
3. 选项逐解：
   - 正确选项论证（提供权威依据）
   - 干扰项破析（错误根源定位）
4. 解题示范：
   [标准步骤] 题干分析→关键识别→排除验证→确认选择
5. 认知强化：
   - 易混概念对比表
   - 典型错误案例
   - 记忆锚点建议
6. 拓展探究：
   - 现实应用场景举例
   - 相关技术演进脉络
   - 推荐进阶学习资源`;
    }

    await this.sendToAI(prompt);
  },

  async sendCurrentQuestion() {
    const question = this.data.currentQuestion;
    const prompt = `作为计算机考试辅导老师，请对这道${question.type}的题目进行全面分析：
题目：${question.title}
选项：
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}

指导要求：
1. 关键词解码（术语解析+语境意义）
2. 思维脚手架：
   - 问题转化方法（将题干转换为已知问题模式）
   - 线索关联提示（与已学知识的连接点）
3. 排除法策略：
   - 绝对化表述识别
   - 范畴错位判断
   - 条件矛盾检测
4. 元认知提示：
   "你应该检查是否理解___概念"
   "建议回顾___知识点的应用场景"
5. 渐进式提示设计（仅当请求进一步帮助时展开）
6. 严格避免直接答案，保持苏格拉底式提问引导`;

    await this.sendToAI(prompt);
  },

  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  async sendToAI(prompt) {
    try {
      const messages = [...this.data.messages];
      const cleanPrompt = prompt.replace(/[#*`]/g, '');
      messages.push({
        role: 'user',
        content: cleanPrompt
      });
      
      this.setData({ 
        messages,
        lastMessageId: `msg-${messages.length - 1}`
      });

      wx.showLoading({ title: '思考中...' });

      if(this.data.xfConfig.currentModel === 'xunfei') {
        await this.sendToXunfei(cleanPrompt);
      } else if(this.data.xfConfig.currentModel === 'kimi') {
        await this.sendToKimi(cleanPrompt);
      } else if(this.data.xfConfig.currentModel === 'zhinao') {
        await this.sendToZhinao(cleanPrompt);
      }

    } catch (err) {
      console.error('请求失败:', err);
      wx.showToast({
        title: '响应失败',
        icon: 'none'
      });
      wx.hideLoading();
    }
  },

  // 生成讯飞API签名
  generateSignature(apiKey, apiSecret, host, path, date) {
    const signatureOrigin = `host: ${host}\ndate: ${date}\nPOST ${path} HTTP/1.1`;
    
    // 使用微信小程序的API进行Base64编码
    const base64Encode = (str) => {
      return wx.arrayBufferToBase64(new Uint8Array([...str].map(char => char.charCodeAt(0))));
    };
    
    // 使用微信小程序的API进行SHA256加密
    const hmacsha256 = (str, secret) => {
      return wx.arrayBufferToBase64(
        wx.createHash('sha256', base64Encode(secret))
          .update(str)
          .digest()
      );
    };
    
    const signatureSha = hmacsha256(signatureOrigin, apiSecret);
    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = base64Encode(authorizationOrigin);
    
    return `Hmac ${authorization}`;
  },

  // 讯飞星火API调用
  async sendToXunfei(prompt) {
    try {
      const { apiPassword } = this.data.xfConfig;
      const url = 'https://spark-api-open.xf-yun.com/v1/chat/completions';

      const response = await wx.request({
        url: url,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiPassword}`
        },
        data: {
          model: "generalv3.5",
          messages: [
            {
              role: "system",
              content: "你是一位经验丰富的计算机考试辅导老师，擅长通过清晰的讲解和分析帮助学生理解和掌握计算机相关知识。你的回答应该专业、系统、易懂，并注重实用性。请用中文回答，避免使用过于专业的术语，注重知识点的联系和应用。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false
        },
        success: (res) => {
          console.log('讯飞大模型API响应:', res);
          if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices[0]) {
            const aiMessage = {
              role: 'assistant',
              content: res.data.choices[0].message.content
            };
            
            const updatedMessages = [...this.data.messages, aiMessage];
            this.setData({ 
              messages: updatedMessages,
              lastMessageId: `msg-${updatedMessages.length - 1}`
            });
          } else {
            console.error('讯飞大模型响应格式错误:', res);
            wx.showToast({
              title: res.data?.error?.message || '讯飞大模型响应格式错误',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('讯飞大模型请求失败:', err);
          wx.showToast({
            title: '讯飞大模型响应失败',
            icon: 'none'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (err) {
      console.error('讯飞大模型请求失败:', err);
      throw err;
    }
  },

  // Kimi API调用
  async sendToKimi(prompt) {
    try {
      const response = await wx.request({
        url: 'https://api.moonshot.cn/v1/chat/completions',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.data.kimiConfig.apiKey}`
        },
        data: {
          model: "moonshot-v1-8k",
          messages: [
            {
              role: "system",
              content: "你是一位经验丰富的计算机考试辅导老师，擅长通过清晰的讲解和分析帮助学生理解和掌握计算机相关知识。你的回答应该专业、系统、易懂，并注重实用性。请用中文回答，避免使用过于专业的术语，注重知识点的联系和应用。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices[0]) {
            const cleanContent = res.data.choices[0].message.content.replace(/[#*`]/g, '');
            const aiMessage = {
              role: 'assistant',
              content: cleanContent
            };
            
            const updatedMessages = [...this.data.messages, aiMessage];
            this.setData({ 
              messages: updatedMessages,
              lastMessageId: `msg-${updatedMessages.length - 1}`
            });
          } else {
            console.error('Kimi 大模型响应格式错误:', res);
            wx.showToast({
              title: 'Kimi 大模型响应格式错误',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('Kimi 大模型请求失败:', err);
          wx.showToast({
            title: 'Kimi 大模型响应失败',
            icon: 'none'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (err) {
      console.error('Kimi 大模型请求失败:', err);
      throw err;
    }
  },

  // 智脑API调用
  async sendToZhinao(prompt) {
    try {
      const response = await wx.request({
        url: 'https://api.360.cn/v1/chat/completions',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.data.zhinaoConfig.apiKey}`
        },
        data: {
          model: "360gpt-pro",
          messages: [
            {
              role: "system",
              content: "你是一位经验丰富的计算机考试辅导老师，擅长通过清晰的讲解和分析帮助学生理解和掌握计算机相关知识。你的回答应该专业、系统、易懂，并注重实用性。请用中文回答，避免使用过于专业的术语，注重知识点的联系和应用。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          stream: false
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices[0]) {
            const cleanContent = res.data.choices[0].message.content.replace(/[#*`]/g, '');
            const aiMessage = {
              role: 'assistant',
              content: cleanContent
            };
            
            const updatedMessages = [...this.data.messages, aiMessage];
            this.setData({ 
              messages: updatedMessages,
              lastMessageId: `msg-${updatedMessages.length - 1}`
            });
          } else {
            console.error('智脑 大模型响应格式错误:', res);
            wx.showToast({
              title: res.data?.error?.message || '智脑 大模型响应格式错误',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('智脑 大模型请求失败:', err);
          wx.showToast({
            title: '智脑 大模型响应失败',
            icon: 'none'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (err) {
      console.error('智脑 大模型请求失败:', err);
      throw err;
    }
  },

  // 修改切换AI模型的逻辑
  toggleAIModel() {
    let currentModel = this.data.xfConfig.currentModel;
    if (currentModel === 'xunfei') {
      currentModel = 'kimi';
    } else if (currentModel === 'kimi') {
      currentModel = 'zhinao';
    } else {
      currentModel = 'xunfei';
    }
    
    this.setData({
      ['xfConfig.currentModel']: currentModel
    });
    
    const modelNames = {
      'xunfei': '讯飞星火',
      'kimi': 'Kimi',
      'zhinao': '智脑'
    };
    
    wx.showToast({
      title: `已切换至${modelNames[currentModel]}`,
      icon: 'none'
    });
  },

  onUnload() {
    // 清理考试数据缓存
    wx.removeStorageSync('examQuestions');
    wx.removeStorageSync('selectedAnswers');
  }
})