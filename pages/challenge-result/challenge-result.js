Page({
  data: {
    score: 0,
    correctCount: 0,
    totalQuestions: 0,
    wrongCount: 0,
    answeredCount: 0,
    correctRate: 0,
    darkMode: false,
    isPassed: false,
    mode: 'challenge',
    answerDetails: [],
    timeUsed: 0,
    formatTimeUsed: '00:00'
  },

  onLoad() {
    // 获取挑战结果
    const result = wx.getStorageSync('challengeResult');
    if (!result) {
      wx.showToast({
        title: '获取结果失败',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 获取挑战配置
    const config = wx.getStorageSync('challengeConfig');
    if (!config) {
      wx.showToast({
        title: '配置获取失败',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 计算正确率 - 只使用已答题数量计算
    const correctRate = result.answeredCount > 0 ? 
      Math.round((result.correctCount / result.answeredCount) * 100) : 0;

    // 判断是否通过
    const isPassed = result.answeredCount > 0 && 
      (result.correctCount / result.answeredCount) * 100 >= config.passScore;

    // 格式化用时
    const minutes = Math.floor(result.timeUsed / 60);
    const seconds = result.timeUsed % 60;
    const formatTimeUsed = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    this.setData({
      score: result.score,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      answeredCount: result.answeredCount,
      totalQuestions: result.totalQuestions,
      correctRate,
      isPassed,
      timeUsed: result.timeUsed,
      formatTimeUsed,
      darkMode: wx.getStorageSync('darkMode') || false,
      answerDetails: result.questions.map((question, index) => ({
        index: index + 1,
        title: question.title,
        correctAnswer: question.answer,
        userAnswer: question.userAnswer || '未作答',
        isCorrect: question.userAnswer === question.answer,
        options: {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD
        },
        source: question.source || '未知题库'
      }))
    });

    // 更新每日答题统计
    this.updateDailyStats(result.correctCount, result.wrongCount);
  },

  // 更新每日答题统计
  async updateDailyStats(correctCount, wrongCount) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        console.log('用户未登录，跳过更新统计');
        return;
      }

      // 计算获得的积分：每道正确题目获得2分
      const points = correctCount * 2;
      
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

        // 更新用户数据 - 添加刷题统计数据的更新
        await db.collection('users').doc(user._id).update({
          data: {
            points: newPoints,
            signDays: newSignDays,
            totalQuestions: _.inc(this.data.totalQuestions), // 增加总题数
            correctQuestions: _.inc(correctCount),           // 增加正确题数
            wrongQuestions: _.inc(wrongCount),              // 增加错误题数
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

  // 重新挑战
  retakeExam() {
    wx.redirectTo({
      url: '/pages/challenge-config/challenge-config'
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onShow() {
    const app = getApp();
    if (this.data.darkMode !== app.globalData.darkMode) {
      this.setData({
        darkMode: app.globalData.darkMode
      });
      wx.setNavigationBarColor({
        frontColor: app.globalData.darkMode ? '#ffffff' : '#000000',
        backgroundColor: app.globalData.darkMode ? '#2d2d2d' : '#ffffff'
      });
    }
  }
}); 