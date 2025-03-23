const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    level: 1,
    score: 0,
    stars: 0,
    points: 0,
    total: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: '0%',
    evaluationText: '',
    unlockNextLevel: false,
    darkMode: false,
    iconBaseUrl: app.globalData.iconBaseUrl,
    userInfo: null
  },

  onLoad: function(options) {
    // 获取用户信息
    const authInfo = wx.getStorageSync('authInfo');
    if (authInfo?.userInfo) {
      this.setData({
        userInfo: authInfo.userInfo
      });
    }

    // 设置暗黑模式
    this.setData({
      darkMode: app.globalData.darkMode
    });

    if (options) {
      const { level, score, total, correct, wrong, points, timeUsed } = options;
      
      // 计算正确率
      const accuracy = Math.round((correct / total) * 100);
      
      // 计算星星数量
      let stars = 0;
      if (accuracy >= 30) stars = 1;
      if (accuracy >= 70) stars = 2;
      if (accuracy === 100) stars = 3;
      
      // 生成评价文本
      const evaluationText = this.generateEvaluationText(accuracy);
      
      // 判断是否解锁下一关（获得1星即可）
      const unlockNextLevel = stars >= 1;

      this.setData({
        level: parseInt(level),
        score: parseInt(score),
        total: parseInt(total),
        correctCount: parseInt(correct),
        wrongCount: parseInt(wrong),
        points: parseInt(points),
        timeUsed: timeUsed || '0分0秒',
        accuracy: accuracy + '%',
        stars,
        evaluationText,
        unlockNextLevel
      }, () => {
        // 更新用户进度
        this.updateUserProgress();
        if (this.data.points > 0) {
          this.updateUserPoints();
        }
      });
    }
  },

  // 更新用户进度
  async updateUserProgress() {
    try {
      const { level, stars, userInfo } = this.data;
      if (!userInfo) return;

      // 构建查询条件
      const whereCondition = {};
      if (userInfo.openid) {
        whereCondition._openid = userInfo.openid;
      } else if (userInfo.phoneNumber) {
        whereCondition.phoneNumber = userInfo.phoneNumber;
      } else {
        throw new Error('无法获取用户标识');
      }

      // 获取当前进度
      const { data } = await db.collection('user_breakthrough')
        .where(whereCondition)
        .get();

      if (data && data.length > 0) {
        const progress = data[0];
        const levelStars = progress.levelStars || new Array(30).fill(0);
        
        // 更新星星数量（只在超过现有星星数时更新）
        if (stars > levelStars[level - 1]) {
          levelStars[level - 1] = stars;
        }
        
        // 如果获得了至少1星，解锁下一关
        const nextLevel = level + 1;
        const currentLevel = progress.currentLevel || 1;
        const newLevel = stars >= 1 && nextLevel > currentLevel ? nextLevel : currentLevel;

        // 更新数据库
        await db.collection('user_breakthrough')
          .doc(progress._id)
          .update({
            data: {
              currentLevel: newLevel,
              levelStars: levelStars,
              updateTime: db.serverDate()
            }
          });
      }
    } catch (error) {
      console.error('更新用户进度失败:', error);
      wx.showToast({
        title: '更新进度失败',
        icon: 'none'
      });
    }
  },

  // 更新用户积分
  async updateUserPoints() {
    try {
      const { points, userInfo, correctCount, wrongCount } = this.data;
      if (!userInfo || points <= 0) return;

      // 构建查询条件
      const whereCondition = {};
      if (userInfo.openid) {
        whereCondition._openid = userInfo.openid;
      } else if (userInfo.phoneNumber) {
        whereCondition.phoneNumber = userInfo.phoneNumber;
      } else {
        throw new Error('无法获取用户标识');
      }

      // 计算实际答题数量
      const actualAnsweredQuestions = correctCount + wrongCount;

      // 更新用户积分和答题统计
      const _ = db.command;
      await db.collection('users')
        .where(whereCondition)
        .update({
          data: {
            points: _.inc(points),
            totalQuestions: _.inc(actualAnsweredQuestions), // 只增加实际答题数量
            correctQuestions: _.inc(correctCount),
            wrongQuestions: _.inc(wrongCount),
            updateTime: db.serverDate()
          }
        });

    } catch (error) {
      console.error('更新用户积分失败:', error);
      wx.showToast({
        title: '更新积分失败',
        icon: 'none'
      });
    }
  },

  generateEvaluationText(accuracy) {
    if (accuracy === 100) {
      return '完美！你答对了所有题目！';
    } else if (accuracy >= 70) {
      return '很棒！继续保持！';
    } else if (accuracy >= 30) {
      return '还不错，继续加油！';
    } else {
      return '别灰心，再接再厉！';
    }
  },

  retryLevel() {
    const { level } = this.data;
    wx.redirectTo({
      url: `/packageExam/pages/breakthrough-practice/breakthrough-practice?level=${level}`
    });
  },

  nextLevel() {
    if (!this.data.unlockNextLevel) {
      wx.showToast({
        title: '需要获得至少1颗星才能解锁下一关',
        icon: 'none'
      });
      return;
    }

    const nextLevel = this.data.level + 1;
    if (nextLevel > 30) {
      wx.showToast({
        title: '恭喜你完成所有关卡！',
        icon: 'success'
      });
      return;
    }

    wx.redirectTo({
      url: `/packageExam/pages/breakthrough-practice/breakthrough-practice?level=${nextLevel}`
    });
  },

  // 返回关卡列表
  backToLevels() {
    wx.navigateBack({
      delta: 2  // 返回两层，跳过答题页面直接回到闯关列表
    })
  },

  onShareAppMessage() {
    const title = `我在闯关答题中获得了${this.data.score}分，获得${this.data.stars}颗星！`
    return {
      title: title,
      path: '/pages/index/index',
      imageUrl: `${this.data.iconBaseUrl}/logo.png?width=500&height=400`
    }
  },

  onShareTimeline() {
    const { level, score, stars } = this.data;
    return {
      title: `我在答题闯关第${level}关获得了${score}分，${stars}颗星！快来挑战吧！`,
      query: `level=${level}`,
      imageUrl: `${this.data.iconBaseUrl}/logo.png?width=500&height=400`
    };
  }
}); 