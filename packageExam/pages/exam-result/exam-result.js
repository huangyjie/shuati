Page({
  data: {
    score: 0,
    correctCount: 0,
    totalQuestions: 0,
    paperId: null,
    wrongQuestions: [],
    passScore: 90,
    examRecord: null,
    wrongCount: 0,
    answeredCount: 0,
    correctRate: 0,
    darkMode: false,
    isPassed: false,
    mode: '',
    answerDetails: [],
  },

  onLoad(options) {
    console.log('接收到的参数:', options);
    
    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    
    // 获取当前考试数据
    const examData = wx.getStorageSync('currentExamData');
    
    if (examData) {
      // 使用保存的考试数据
      const {
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions,
        questions,
        selectedAnswers,
        mode
      } = examData;

      // 计算分数：每题3分
      const score = correctCount * 3;

      // 计算正确率
      const correctRate = answeredCount > 0 ? 
        Math.round((correctCount / answeredCount) * 100) : 0;

      // 判断是否通过
      const isPassed = score >= 90;

      // 处理答题详情
      const answerDetails = questions.map((question, index) => {
        const userAnswer = selectedAnswers[index];
        return {
          index: index + 1,
          title: question.title,
          correctAnswer: question.answer,
          userAnswer: userAnswer || '未作答',
          isCorrect: userAnswer === question.answer,
          options: {
            A: question.optionA,
            B: question.optionB,
            C: question.optionC,
            D: question.optionD
          },
          source: question.source || '未知题库'
        };
      });

      this.setData({
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions,
        correctRate,
        paperId: options.paperId || null,
        passScore: 90,
        isPassed,
        mode: mode || options.mode,
        answerDetails,
        darkMode
      }, () => {
        // 在设置完数据后更新统计
        this.updateDailyStats(correctCount, wrongCount);
      });

      // 清除考试数据
      wx.removeStorageSync('currentExamData');
    } else {
      // 使用URL参数
      const score = parseInt(options.score) || 0;
      const correctCount = parseInt(options.correctCount) || 0;
      const wrongCount = parseInt(options.wrongCount) || 0;
      const answeredCount = parseInt(options.answeredCount) || 0;
      const totalQuestions = parseInt(options.totalQuestions) || 20;
      const mode = options.mode || '';

      // 计算正确率
      const correctRate = answeredCount > 0 ? 
        Math.round((correctCount / answeredCount) * 100) : 0;

      // 判断是否通过
      const isPassed = score >= 90;

      this.setData({
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions,
        correctRate,
        paperId: options.paperId || null,
        passScore: 90,
        isPassed,
        mode,
        darkMode
      }, () => {
        // 在设置完数据后更新统计
        this.updateDailyStats(correctCount, wrongCount);
      });
    }

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });
  },

  // 更新每日答题统计
  async updateDailyStats(correctCount, wrongCount) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        console.log('用户未登录，跳过更新统计');
        return;
      }

      // 计算获得的积分：每道正确题目获得3分
      const points = correctCount * 3;
      
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 获取用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: app.globalData.userInfo.phoneNumber
        })
        .get();

      if (users.length > 0) {
        const user = users[0];
        const currentPoints = user.points || 0;
        const newPoints = currentPoints + points;
        const newSignDays = Math.floor(newPoints / 20); // 每20积分算一天

        // 计算实际答题数量（只计算已作答的题目）
        const actualAnsweredQuestions = correctCount + wrongCount;

        // 更新用户数据 - 只更新实际答题数量
        await db.collection('users').doc(user._id).update({
          data: {
            points: newPoints,
            signDays: newSignDays,
            totalQuestions: _.inc(actualAnsweredQuestions), // 只增加实际答题数量
            correctQuestions: _.inc(correctCount),
            wrongQuestions: _.inc(wrongCount),
            lastAnswerTime: db.serverDate()
          }
        });

        // 更新显示
        this.setData({
          'userInfo.points': newPoints,
          'userInfo.signDays': newSignDays
        });

        // 显示获得积分的提示
        wx.showToast({
          title: `获得${points}积分！\n已累计${newSignDays}天`,
          icon: 'none',
          duration: 2000
        });

        // 更新全局数据
        app.globalData.userInfo = {
          ...app.globalData.userInfo,
          points: newPoints,
          signDays: newSignDays
        };

        // 更新本地存储
        const authInfo = wx.getStorageSync('authInfo');
        if (authInfo) {
          authInfo.userInfo = {
            ...authInfo.userInfo,
            points: newPoints,
            signDays: newSignDays
          };
          wx.setStorageSync('authInfo', authInfo);
        }
      }
    } catch (err) {
      console.error('更新每日答题统计失败:', err);
      wx.showToast({
        title: '更新统计失败',
        icon: 'none'
      });
    }
  },

  // 查看错题
  viewWrongQuestions() {
    wx.reLaunch({
      url: '/pages/wrong/wrong',
      success: () => {
        setTimeout(() => {
          const wrongPage = getCurrentPages().find(page => page.route === 'pages/wrong/wrong');
          if (wrongPage && wrongPage.loadWrongQuestions) {
            wrongPage.loadWrongQuestions();
          }
        }, 500);
      }
    });
  },

  // 重新考试
  retakeExam() {
    wx.redirectTo({
      url: `/packageExam/pages/random-practice/random-practice?mode=${this.data.mode}`
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
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
  }
});