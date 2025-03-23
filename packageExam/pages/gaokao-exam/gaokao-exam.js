const app = getApp();

Page({
  data: {
    paperId: null,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedAnswers: {},
    remainingTime: 1200,
    timer: null,
    showConfirmSubmit: false,
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showAnswerCard: false,
    showSettings: false,
    loading: true
  },

  onLoad(options) {
    const { mode } = options;
    // 从全局状态获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    
    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });
    
    // 如果是高考抽题模式
    if (mode === 'exam') {
      console.log('加载高考抽题');
      const examQuestions = wx.getStorageSync('examQuestions') || [];
      if (examQuestions.length > 0) {
        this.setData({
          questions: examQuestions,
          currentQuestion: examQuestions[0],
          currentIndex: 0,
          totalQuestions: examQuestions.length,
          remainingTime: 1200,
          loading: false
        });
        this.startTimer();
        return;
      }
    }
    
    // 如果没有缓存的题目，直接加载新题目
    this.loadQuestions();
  },

  async loadQuestions() {
    try {
      wx.showLoading({
        title: '加载题目中...',
      });

      if (!wx.cloud) {
        throw new Error('云开发未初始化');
      }

      const db = wx.cloud.database();
      const collections = ['hardware', 'Base', 'Internet', 'Software', 'Xinchuang'];
      let allQuestions = [];

      // 从每个集合获取10题
      for (const collection of collections) {
        try {
          // 获取集合中的题目总数
          const { total } = await db.collection(collection).count();
          
          if (total === 0) continue;

          // 生成10个不重复的随机索引
          const randomIndexes = [];
          while (randomIndexes.length < 10) {
            const randomIndex = Math.floor(Math.random() * total);
            if (!randomIndexes.includes(randomIndex)) {
              randomIndexes.push(randomIndex);
            }
          }

          // 获取题目
          for (let index of randomIndexes) {
            const { data } = await db.collection(collection)
              .skip(index)
              .limit(1)
              .get();
              
            if (data && data[0]) {
              // 添加题目来源信息
              data[0].source = collection;
              allQuestions.push(data[0]);
            }
          }
        } catch (error) {
          console.error(`从${collection}获取题目失败:`, error);
        }
      }

      if (allQuestions.length === 0) {
        throw new Error('未获取到题目');
      }

      // 打乱题目顺序
      const shuffledQuestions = this.shuffleArray(allQuestions);

      this.setData({
        questions: shuffledQuestions,
        currentQuestion: shuffledQuestions[0],
        currentIndex: 0,
        totalQuestions: shuffledQuestions.length,
        loading: false,
        timeDisplay: this.formatTime(this.data.remainingTime)
      });

      this.startTimer();
      wx.hideLoading();

    } catch (error) {
      console.error('加载题目失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 添加数组打乱方法
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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

  // 格式化时间显示
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}秒`;
  },

  // 开始计时器
  startTimer() {
    this.data.timer = setInterval(() => {
      if (this.data.remainingTime <= 0) {
        clearInterval(this.data.timer);
        wx.showModal({
          title: '提示',
          content: '考试时间已到，系统将自动提交试卷',
          showCancel: false,
          success: () => {
            this.submitExam();
          }
        });
        return;
      }

      const remainingTime = this.data.remainingTime - 1;
      this.setData({
        remainingTime,
        timeDisplay: this.formatTime(remainingTime) // 添加格式化后的时间显示
      });
    }, 1000);
  },

  // 选择答案
  handleOptionSelect(e) {
    const { option } = e.currentTarget.dataset;
    const { currentIndex, questions, autoNext, autoSubmit } = this.data;
    
    this.setData({
      [`selectedAnswers.${currentIndex}`]: option
    });

    console.log(`已选择答案 - 题目${currentIndex + 1}:`, option);

    // 如果开启了自动下一题且不是最后一题
    if (autoNext && currentIndex < questions.length - 1) {
      setTimeout(() => {
        this.handleNext();
      }, 1000);
    }
    // 如果是最后一题且开启了自动提交
    else if (autoSubmit && currentIndex === questions.length - 1) {
      setTimeout(() => {
        this.submitExam();
      }, 1000);
    }
  },

  // 上一题
  handlePrevious() {
    if (this.data.currentIndex > 0) {
      const newIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: newIndex,
        currentQuestion: this.data.questions[newIndex]
      });
    }
  },

  // 下一题
  handleNext() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const newIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: newIndex,
        currentQuestion: this.data.questions[newIndex]
      });
    }
  },

  // 显示提交确认
  showSubmitConfirm() {
    const unansweredCount = this.getUnansweredCount();
    
    this.setData({
      showConfirmSubmit: true,
      unansweredCount
    });
  },

  // 取未答题数量
  getUnansweredCount() {
    const { questions, selectedAnswers } = this.data;
    return questions.length - Object.keys(selectedAnswers).length;
  },

  // 提交试卷
  submitExam() {
    wx.showModal({
      title: '确认提交',
      content: '确定要提交答案吗？',
      success: (res) => {
        if (res.confirm) {
          this.calculateResult();
        }
      }
    });
  },

  onUnload() {
    
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  toggleAutoSubmit(e) {
    this.setData({
      autoSubmit: e.detail.value
    });
  },

  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);
  },

  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
  },

  toggleAnswerCard() {
    this.setData({
      showAnswerCard: !this.data.showAnswerCard
    });
  },

  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswerCard: false
    });
  },

  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  preventBubble() {
    return;
  },

  // 修改结算结果方法 
  async calculateResult() {
    try {
      const { questions, selectedAnswers } = this.data;
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

      // 计算得分 - 改为百分制
      const score = Math.round((correctCount / questions.length) * 100);

      // 更新错题本
      let existingWrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      
      // 添加错题
      questions.forEach((question, index) => {
        const userAnswer = selectedAnswers[index];
        if (userAnswer && userAnswer !== question.answer) {
          // 构造错题对象
          const wrongQuestion = {
            序号: index + 1,
            title: question.title,
            optionA: question.optionA || question.A,
            optionB: question.optionB || question.B,
            optionC: question.optionC || question.C,
            optionD: question.optionD || question.D,
            answer: question.answer,
            userAnswer: userAnswer,
            type: '高考模拟',
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
          source: '高考模拟'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        mode: 'gaokao-exam',
        timestamp: Date.now()
      };

      wx.setStorageSync('currentExamData', examData);

      // 更新统计数据
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const totalCorrect = wx.getStorageSync('correctCount') || 0;
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
      wx.setStorageSync('correctCount', totalCorrect + correctCount);

      // 跳转到结果页面
      wx.redirectTo({
        url: `/packageExam/pages/exam-result/exam-result?` +
             `score=${score}&` +
             `correctCount=${correctCount}&` +
             `wrongCount=${wrongCount}&` +
             `answeredCount=${answeredCount}&` +
             `totalQuestions=${questions.length}&` +
             `mode=gaokao-exam`
      });

    } catch (err) {
      console.error('计算结果失败:', err);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }
  },

  // 修改 uploadScore 方法
  async uploadScore(score, correctCount, wrongCount, answeredCount) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        console.log('用户未登录，不上传分数');
        return;
      }

      wx.showLoading({
        title: '保存成绩...',
        mask: true
      });

      const db = wx.cloud.database();
      
      // 获取当前用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: app.globalData.userInfo.phoneNumber
        })
        .get();

      if (users.length === 0) {
        console.log('未找到用户信息');
        wx.hideLoading();
        return;
      }

      const user = users[0];

      // 添加考试记录（只包含已作答的题目数据）
      const result = await db.collection('mockExams').add({
        data: {
          userId: user._id,
          phoneNumber: user.phoneNumber,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          score: score,
          correctCount: correctCount,
          wrongCount: wrongCount,
          answeredCount: answeredCount, // 添加实作答数量
          submitTime: db.serverDate(),
          totalQuestions: this.data.questions.length,
          correctRate: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0 // 修改正确率计算方式
        }
      });

      // 更新用户最高分和答题统计（只更新已作答的题目）
      await db.collection('users').doc(user._id).update({
        data: {
          highestScore: db.command.max([score, user.highestScore || 0]),
          totalQuestions: db.command.inc(answeredCount), // 只增加已作答的题目数量
          correctQuestions: db.command.inc(correctCount),
          wrongQuestions: db.command.inc(wrongCount),
          lastExamTime: db.serverDate()
        }
      });

      wx.hideLoading();
    } catch (err) {
      console.error('上传成绩失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '成绩保存失败',
        icon: 'none'
      });
    }
  },

  // 添加隐藏提交确认框的方法
  hideSubmitConfirm() {
    this.setData({
      showConfirmSubmit: false
    });
  }
}); 