// packageExam/pages/breakthrough-practice/breakthrough-practice.js
const app = getApp();
const db = wx.cloud.database();

Page({

  /**
   * 页面的初始数据
   */
  data: {
    iconBaseUrl: app.globalData.iconBaseUrl,
    darkMode: false,
    questions: [],
    currentIndex: 0,
    currentQuestion: {},
    selectedAnswers: [],
    showSettings: false,
    showAnswerCard: false,
    autoNext: false,
    autoSubmit: false,
    level: 1,
    totalQuestions: 0,
    isLoading: true,
    startTime: 0,
    timeUsed: '0:00',
    timer: null,
    timeLimit: 0,  // 时间限制（秒）
    remainingTime: 0,  // 剩余时间（秒）
    remainingTimeText: '0:00',  // 格式化后的剩余时间
    isTimeUp: false,  // 是否时间到
    userInfo: null,
    isLogin: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { level, count } = options;
    
    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    if (!authInfo?.isLogin || !authInfo?.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再进行答题闯关',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/comprehensive/comprehensive'
            });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    const currentLevel = parseInt(level) || 1;
    const timeLimit = this.getTimeLimit(currentLevel);

    // 设置页面数据
    this.setData({
      startTime: Date.now(),
      level: currentLevel,
      userInfo: authInfo.userInfo,
      isLogin: true,
      darkMode: wx.getStorageSync('darkMode') || false,
      timeLimit: timeLimit * 60,  // 转换为秒
      remainingTime: timeLimit * 60
    });

    // 设置导航栏
    wx.setNavigationBarTitle({
      title: `第${level}关${timeLimit ? ' - ' + timeLimit + '分钟' : ''}`
    });
    this.updateNavigationBarColor();

    // 加载题目
    this.loadQuestions(parseInt(count) || 50);

    // 开始计时
    this.setData({
      timer: setInterval(() => {
        const currentTime = Date.now();
        const diff = Math.floor((currentTime - this.data.startTime) / 1000); // 转换为秒
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        
        // 更新已用时间
        this.setData({
          timeUsed: `${minutes}:${seconds.toString().padStart(2, '0')}`
        });

        // 如果有时间限制，更新剩余时间
        if (this.data.timeLimit > 0) {
          const remaining = this.data.timeLimit - diff;
          if (remaining <= 0 && !this.data.isTimeUp) {
            // 时间到，自动提交
            this.setData({ 
              isTimeUp: true,
              remainingTime: 0,
              remainingTimeText: '0:00'
            });
            wx.showModal({
              title: '提示',
              content: '答题时间已到，系统将自动提交答案',
              showCancel: false,
              success: () => {
                this.processSubmission();
              }
            });
          } else if (remaining > 0) {
            const remainingMinutes = Math.floor(remaining / 60);
            const remainingSeconds = remaining % 60;
            this.setData({
              remainingTime: remaining,
              remainingTimeText: `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
            });

            // 当剩余时间少于5分钟时，提醒用户
            if (remaining === 300) { // 5分钟
              wx.showToast({
                title: '还剩5分钟答题时间',
                icon: 'none',
                duration: 2000
              });
            } else if (remaining === 60) { // 1分钟
              wx.showToast({
                title: '还剩1分钟答题时间',
                icon: 'none',
                duration: 2000
              });
            }
          }
        }
      }, 1000)
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 更新导航栏颜色
  updateNavigationBarColor() {
    if (this.data.darkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#2d2d2d'
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#ffffff'
      });
    }
  },

  async loadQuestions(questionCount) {
    try {
      wx.showLoading({
        title: '加载题目中...',
        mask: true
      });

      // 获取题库总数
      const { total } = await db.collection('questions').count();
      
      // 生成随机索引
      const randomIndexes = new Set();
      while (randomIndexes.size < questionCount) {
        randomIndexes.add(Math.floor(Math.random() * total));
      }

      // 分批获取题目
      const batchSize = 20; // 云数据库一次最多获取20条
      const tasks = [];
      const indexArray = Array.from(randomIndexes);
      
      for (let i = 0; i < indexArray.length; i += batchSize) {
        const batch = indexArray.slice(i, Math.min(i + batchSize, indexArray.length));
        const promise = db.collection('questions')
          .skip(batch[0])
          .limit(batch.length)
          .get();
        tasks.push(promise);
      }

      const results = await Promise.all(tasks);
      const questions = results.reduce((acc, res) => acc.concat(res.data), []);

      // 获取收藏题目列表
      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const favoriteIds = favoriteQuestions.map(q => q._id);

      // 处理题目数据
      const processedQuestions = questions.map((q, index) => {
        return {
          ...q,
          title: q.title || q.question || '',  // 题目内容
          optionA: q.A || q.optionA || '',     // 选项A
          optionB: q.B || q.optionB || '',     // 选项B
          optionC: q.C || q.optionC || '',     // 选项C
          optionD: q.D || q.optionD || '',     // 选项D
          isFavorite: favoriteIds.includes(q._id)
        };
      });

      this.setData({
        questions: processedQuestions,
        currentQuestion: processedQuestions[0],
        totalQuestions: processedQuestions.length,
        selectedAnswers: new Array(processedQuestions.length).fill(''),
        isLoading: false
      });

    } catch (error) {
      console.error('加载题目失败:', error);
      wx.showToast({
        title: '加载题目失败',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    } finally {
      wx.hideLoading();
    }
  },

  // 切换设置面板
  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  // 切换答题卡
  toggleAnswerCard() {
    this.setData({
      showAnswerCard: !this.data.showAnswerCard
    });
  },

  // 切换自动下一题
  toggleAutoNext({ detail }) {
    this.setData({
      autoNext: detail.value
    });
    wx.setStorageSync('autoNext', detail.value);
  },

  // 切换自动提交
  toggleAutoSubmit({ detail }) {
    this.setData({
      autoSubmit: detail.value
    });
    wx.setStorageSync('autoSubmit', detail.value);
  },

  // 切换夜间模式
  toggleDarkMode({ detail }) {
    const darkMode = detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);
    this.updateNavigationBarColor();
  },

  // 切换收藏状态
  async toggleFavorite() {
    const { currentQuestion, currentIndex, questions } = this.data;
    const newQuestions = [...questions];
    const newStatus = !currentQuestion.isFavorite;
    newQuestions[currentIndex].isFavorite = newStatus;

    // 获取当前收藏列表
    let favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];

    if (newStatus) {
      // 添加到收藏
      if (!favoriteQuestions.find(q => q._id === currentQuestion._id)) {
        favoriteQuestions.push(currentQuestion);
      }
    } else {
      // 从收藏中移除
      favoriteQuestions = favoriteQuestions.filter(q => q._id !== currentQuestion._id);
    }

    // 更新存储
    wx.setStorageSync('favoriteQuestions', favoriteQuestions);

    this.setData({
      questions: newQuestions,
      ['currentQuestion.isFavorite']: newStatus
    });

    wx.showToast({
      title: newStatus ? '已收藏' : '已取消收藏',
      icon: 'success'
    });
  },

  // 选择答案
  handleOptionTap(e) {
    const option = e.currentTarget.dataset.option;
    const { currentIndex, selectedAnswers, autoNext, questions, autoSubmit } = this.data;

    // 如果已经选择过，不再处理
    if (selectedAnswers[currentIndex]) return;

    // 更新答案
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = option;

    this.setData({
      selectedAnswers: newAnswers
    });

    // 自动下一题
    if (autoNext && currentIndex < questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 500);
    }

    // 自动提交
    if (autoSubmit && currentIndex === questions.length - 1) {
      setTimeout(() => {
        this.submitExam();
      }, 500);
    }
  },

  // 上一题
  prevQuestion() {
    const { currentIndex } = this.data;
    if (currentIndex > 0) {
      this.setData({
        currentIndex: currentIndex - 1,
        currentQuestion: this.data.questions[currentIndex - 1]
      });
    }
  },

  // 下一题
  nextQuestion() {
    const { currentIndex, questions } = this.data;
    if (currentIndex < questions.length - 1) {
      this.setData({
        currentIndex: currentIndex + 1,
        currentQuestion: questions[currentIndex + 1]
      });
    }
  },

  // 跳转到指定题目
  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswerCard: false
    });
  },

  // 提交答题
  async submitExam() {
    const { selectedAnswers, questions } = this.data;
    
    // 检查是否全部答完
    const unanswered = selectedAnswers.findIndex(answer => !answer);
    if (unanswered !== -1) {
      wx.showModal({
        title: '提示',
        content: `第${unanswered + 1}题还未作答，确定要提交吗？`,
        success: (res) => {
          if (res.confirm) {
            this.processSubmission();
          }
        }
      });
    } else {
      this.processSubmission();
    }
  },

  // 处理提交
  async processSubmission() {
    try {
      wx.showLoading({
        title: '正在提交...',
        mask: true
      });

      const { selectedAnswers, questions, level, startTime } = this.data;
      
      // 计算得分
      let correctCount = 0;
      let wrongCount = 0;
      let wrongQuestions = [];  // 存储错题

      questions.forEach((q, index) => {
        if (selectedAnswers[index] === q.answer) {
          correctCount++;
        } else if (selectedAnswers[index]) {  // 如果选择了答案但是错误
          wrongCount++;
          // 添加到错题列表
          wrongQuestions.push({
            ...q,
            userAnswer: selectedAnswers[index],  // 用户的选择
            submitTime: new Date().toISOString(),  // 提交时间
            source: `闯关模式-第${level}关`  // 来源
          });
        }
      });

      // 先更新用户答题统计
      await this.updateUserStats(correctCount, wrongCount);

      // 如果有错题，保存到错题本
      if (wrongQuestions.length > 0) {
        await this.saveWrongQuestions(wrongQuestions);
      }

      const score = Math.round((correctCount / questions.length) * 100);
      
      // 计算星星数量
      let stars = 0;
      if (score >= 30) stars = 1;
      if (score >= 70) stars = 2;
      if (score === 100) stars = 3;

      // 计算获得的积分
      const points = this.calculatePoints(level, score);

      // 计算总用时（分钟）
      const timeUsedInSeconds = Math.floor((Date.now() - this.data.startTime) / 1000);
      const timeUsedInMinutes = Math.floor(timeUsedInSeconds / 60);
      const seconds = timeUsedInSeconds % 60;
      const timeUsedFormatted = `${timeUsedInMinutes}分${seconds}秒`;

      // 清除定时器
      if (this.data.timer) {
        clearInterval(this.data.timer);
      }

      // 更新用户进度
      await this.updateUserProgress(level, stars);

      // 更新用户积分
      if (points > 0) {
        await this.updateUserPoints(points);
      }

      // 跳转到结果页
      wx.redirectTo({
        url: `/packageExam/pages/breakthrough-result/breakthrough-result?level=${level}&score=${score}&total=${questions.length}&correct=${correctCount}&wrong=${wrongCount}&points=${points}&timeUsed=${timeUsedFormatted}`
      });

    } catch (error) {
      console.error('提交失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 更新用户答题统计
  async updateUserStats(correctCount, wrongCount) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 获取用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber
        })
        .get();

      if (users.length > 0) {
        const user = users[0];
        // 直接使用doc更新
        await db.collection('users').doc(user._id).update({
          data: {
            totalQuestions: _.inc(correctCount + wrongCount),  // 增加总答题数
            correctQuestions: _.inc(correctCount),             // 增加正确题数
            wrongQuestions: _.inc(wrongCount),                 // 增加错误题数
            correctRate: Math.round((correctCount / (correctCount + wrongCount)) * 100),  // 更新正确率
            lastAnswerTime: db.serverDate()
          }
        });
      }
    } catch (error) {
      console.error('更新用户答题统计失败:', error);
    }
  },

  // 保存错题到错题本
  async saveWrongQuestions(wrongQuestions) {
    try {
      // 获取本地错题本
      let wrongBook = wx.getStorageSync('wrongQuestions') || [];
      
      // 添加新的错题
      wrongBook = wrongBook.concat(wrongQuestions);
      
      // 保存到本地存储
      wx.setStorageSync('wrongQuestions', wrongBook);
      
      console.log('错题保存成功');
    } catch (error) {
      console.error('保存错题失败:', error);
    }
  },

  // 更新用户进度
  async updateUserProgress(level, stars) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 构建查询条件
      const whereCondition = {};
      if (this.data.userInfo.openid) {
        whereCondition._openid = this.data.userInfo.openid;
      } else if (this.data.userInfo.phoneNumber) {
        whereCondition.phoneNumber = this.data.userInfo.phoneNumber;
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
      // 不抛出错误，让用户仍然可以看到结果
    }
  },

  // 获取时间限制（分钟）
  getTimeLimit(level) {
    if (level <= 15) return 0;  // 初级关卡不限时
    if (level <= 30) return 40; // 进阶关卡限时40分钟
    if (level <= 45) return 25; // 提高关卡限时25分钟
    if (level <= 60) return 20; // 挑战关卡限时20分钟
    if (level <= 75) return 15; // 精英关卡限时15分钟
    return 10;  // 大师关卡限时10分钟
  },

  // 计算获得的积分
  calculatePoints(level, score) {
    let maxPoints = 6;
    if (level > 30 && level <= 60) maxPoints = 8;
    if (level > 60) maxPoints = 12;
    
    return Math.round((score / 100) * maxPoints);
  },

  // 更新用户积分
  async updateUserPoints(points) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 构建查询条件
      const whereCondition = {};
      if (this.data.userInfo.openid) {
        whereCondition._openid = this.data.userInfo.openid;
      } else if (this.data.userInfo.phoneNumber) {
        whereCondition.phoneNumber = this.data.userInfo.phoneNumber;
      } else {
        throw new Error('无法获取用户标识');
      }

      // 更新用户积分
      await db.collection('users')
        .where(whereCondition)
        .update({
          data: {
            points: _.inc(points),
            updateTime: db.serverDate()
          }
        });

    } catch (error) {
      console.error('更新用户积分失败:', error);
      // 不抛出错误，让用户仍然可以看到结果
    }
  },

  preventBubble() {
    return;
  }
})