Page({
  data: {
    scoreDetails: [],
    totalPoints: 0,
    tier: '',
    darkMode: false,
    correctCount: 0,
    wrongCount: 0,
    answeredCount: 0,
    totalQuestions: 20,
    correctRate: 0,
    answerDetails: [],
    showAnimation: false,
    currentPoints: 0,
    statusBarHeight: 0,
    navBarHeight: 44
  },

  onLoad(options) {
    console.log('daily-result onLoad');
    
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });
    
    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    });

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });

    // 获取答题详情
    const examQuestions = wx.getStorageSync('examQuestions') || [];
    const selectedAnswers = wx.getStorageSync('selectedAnswers') || {};
    const app = getApp();
    
    console.log('examQuestions:', examQuestions);
    console.log('selectedAnswers:', selectedAnswers);
    console.log('userInfo:', app.globalData.userInfo);
    
    // 处理答题详情和统计
    let correctCount = 0;
    let wrongCount = 0;
    let totalPoints = 0;

    const answerDetails = examQuestions.map((question, index) => {
      const userAnswer = selectedAnswers[index];
      const isCorrect = userAnswer === question.answer;
      
      // 计算得分
      let points = 0;
      if (userAnswer) { // 只有答过的题目才计算分数
        if (isCorrect) {
          correctCount++;
          switch(app.globalData.userInfo.tier) {
            case '至尊': points = 2; break;
            case '王者': points = 3; break;
            case '大师': points = 4; break;
            case '钻石': points = 5; break;
            case '铂金': points = 6; break;
            case '黄金': points = 7; break;
            case '白银': points = 8; break;
            default: points = 10; // 青铜
          }
        } else {
          wrongCount++;
          switch(app.globalData.userInfo.tier) {
            case '至尊': points = -5; break;
            case '王者': points = -4; break;
            case '大师': points = -3; break;
            case '钻石': points = -2; break;
            case '铂金': points = -2; break;
            case '黄金': points = -1; break;
            case '白银': points = -1; break;
            default: points = 0; // 青铜
          }
        }
        totalPoints += points;
      }

      return {
        index: index + 1,
        title: question.title,
        correctAnswer: question.answer,
        userAnswer: userAnswer || '未作答',
        isCorrect,
        points,
        options: {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD
        }
      };
    });

    const answeredCount = correctCount + wrongCount;
    const correctRate = answeredCount > 0 ? 
      Math.round((correctCount / answeredCount) * 100) : 0;

    console.log('统计结果:', {
      correctCount,
      wrongCount,
      answeredCount,
      totalPoints,
      correctRate
    });

    this.setData({
      answerDetails,
      correctCount,
      wrongCount,
      answeredCount,
      totalQuestions: examQuestions.length,
      correctRate,
      totalPoints,
      tier: app.globalData.userInfo.tier || '青铜'
    });

    // 启动分数动画
    this.startScoreAnimation();
    
    // 更新用户积分
    this.updateUserPoints();
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

  startScoreAnimation() {
    this.setData({ showAnimation: true });
    
    let current = 0;
    const total = this.data.totalPoints;
    const duration = 2000; // 2秒完成动画
    const steps = 50;
    const increment = total / steps;
    const stepDuration = duration / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= total) {
        current = total;
        clearInterval(timer);
      }
      this.setData({ currentPoints: Math.round(current) });
    }, stepDuration);
  },

  async updateUserPoints() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const _ = db.command;

      // 获取用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: app.globalData.userInfo.phoneNumber
        })
        .get();

      console.log('查询到的用户信息:', users);

      if (users.length > 0) {
        const user = users[0];
        const currentPoints = user.points || 0;
        const newPoints = currentPoints + this.data.totalPoints;

        // 计算实际答题数量（只计算已作答的题目）
        const actualAnsweredQuestions = this.data.correctCount + this.data.wrongCount;

        // 更新用户数据 - 只更新实际答题数量
        await db.collection('users').doc(user._id).update({
          data: {
            points: newPoints,
            totalQuestions: _.inc(actualAnsweredQuestions), // 只增加实际答题数量
            correctQuestions: _.inc(this.data.correctCount),
            wrongQuestions: _.inc(this.data.wrongCount),
            lastAnswerTime: db.serverDate()
          }
        });

        // 更新全局数据
        app.globalData.userInfo.points = newPoints;
        console.log('积分更新成功:', newPoints);
      }
    } catch (err) {
      console.error('更新积分失败:', err);
    }
  },

  viewWrongQuestions() {
    wx.reLaunch({
      url: '/pages/wrong/wrong'
    });
  },

  retryExam() {
    wx.redirectTo({
      url: '/pages/daily-practice/daily-practice'
    });
  },

  backToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
}); 