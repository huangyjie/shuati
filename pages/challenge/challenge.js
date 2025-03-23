// pages/challenge/challenge.js
Page({
  data: {
    darkMode: false,
    duration: 0,
    questionCount: 0,
    scorePerQuestion: 0,
    currentIndex: 0,
    questions: [],
    currentQuestion: null,
    selectedAnswers: {},
    timeLeft: 0,
    formatTime: '00:00',
    timeWarning: false,
    showSettings: false,
    showAnswerCard: false,
    autoNext: false,
    timer: null,
    isSubmitting: false,
    selectedCollection: '',
    challengeId: ''
  },

  onLoad() {
    // 获取挑战配置
    const config = wx.getStorageSync('challengeConfig');
    if (!config) {
      wx.showToast({
        title: '配置信息获取失败',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 生成唯一的挑战ID
    const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 检查是否已经提交过
    const submitKey = `challenge_${challengeId}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showModal({
        title: '提示',
        content: '本次挑战已经提交过了',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/challenge-result/challenge-result'
          });
        }
      });
      return;
    }

    // 获取深色模式状态
    this.setData({
      darkMode: wx.getStorageSync('darkMode') || false,
      duration: config.duration,
      questionCount: config.questionCount,
      scorePerQuestion: config.scorePerQuestion,
      timeLeft: config.duration * 60,
      selectedCollection: config.selectedCollection,
      challengeId,
      isSubmitting: false
    });

    // 获取题目
    this.loadQuestions();
  },

  onUnload() {
    // 清除定时器
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  // 加载题目
  async loadQuestions() {
    try {
      wx.showLoading({
        title: '加载题目中...'
      });

      const db = wx.cloud.database();
      const { questionCount, selectedCollection } = this.data;
      
      // 获取选中题库的题目总数
      const { total } = await db.collection(selectedCollection).count();
      
      if (total === 0) {
        throw new Error('题库为空');
      }

      // 生成指定数量的不重复随机索引
      const randomQuestions = [];
      const selectedIndexes = new Set();

      while (randomQuestions.length < questionCount) {
        const randomIndex = Math.floor(Math.random() * total);
        if (!selectedIndexes.has(randomIndex)) {
          selectedIndexes.add(randomIndex);
          const { data } = await db.collection(selectedCollection)
            .skip(randomIndex)
            .limit(1)
            .get();
            
          if (data && data.length > 0) {
            randomQuestions.push(data[0]);
          }
        }
      }

      if (randomQuestions.length === 0) {
        throw new Error('未找到题目');
      }

      // 获取收藏题目列表
      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const favoriteIds = favoriteQuestions.map(q => q._id);

      // 处理题目数据
      const questions = randomQuestions.map(q => ({
        ...q,
        isFavorite: favoriteIds.includes(q._id)
      }));

      this.setData({
        questions,
        currentQuestion: questions[0],
        currentIndex: 0,
        loading: false
      });

      // 开始计时
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
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 开始计时器
  startTimer() {
    const timer = setInterval(() => {
      let timeLeft = this.data.timeLeft - 1;
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        this.submitChallenge();
        return;
      }

      // 格式化时间
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const formatTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // 时间警告（剩余1分钟）
      const timeWarning = timeLeft <= 60;

      this.setData({
        timeLeft,
        formatTime,
        timeWarning
      });
    }, 1000);

    this.setData({ timer });
  },

  // 处理选项点击
  handleOptionTap(e) {
    const { option } = e.currentTarget.dataset;
    const { currentIndex, autoNext } = this.data;
    
    // 更新选中的答案
    const selectedAnswers = { ...this.data.selectedAnswers };
    selectedAnswers[currentIndex] = option;
    
    this.setData({
      selectedAnswers
    });

    // 如果开启了自动下一题，延迟后自动跳转
    if (autoNext && currentIndex < this.data.questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    }
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questions[prevIndex]
      });
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex]
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
  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
  },

  // 切换深色模式
  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);
  },

  // 切换收藏
  toggleFavorite() {
    const { currentQuestion, currentIndex, questions } = this.data;
    let favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    
    const isFavorite = !currentQuestion.isFavorite;
    
    if (isFavorite) {
      // 添加到收藏
      if (!favoriteQuestions.some(q => q._id === currentQuestion._id)) {
        favoriteQuestions.push(currentQuestion);
      }
    } else {
      // 从收藏中移除
      favoriteQuestions = favoriteQuestions.filter(q => q._id !== currentQuestion._id);
    }
    
    // 更新收藏列表
    wx.setStorageSync('favoriteQuestions', favoriteQuestions);
    
    // 更新当前题目的收藏状态
    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      ...currentQuestion,
      isFavorite
    };
    
    this.setData({
      questions: updatedQuestions,
      currentQuestion: updatedQuestions[currentIndex]
    });
    
    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'success'
    });
  },

  // 阻止冒泡
  preventBubble() {
    return;
  },

  // 提交挑战
  async submitChallenge() {
    console.log('提交按钮被点击');
    if (this.data.isSubmitting) {
      console.log('正在提交中，防止重复提交');
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否已经提交过
    const submitKey = `challenge_${this.data.challengeId}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showModal({
        title: '提示',
        content: '本次挑战已经提交过了',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/challenge-result/challenge-result'
          });
        }
      });
      return;
    }
    
    try {
      console.log('开始提交流程');
      this.setData({ isSubmitting: true });
      
      // 停止计时器
      if (this.data.timer) {
        clearInterval(this.data.timer);
        console.log('计时器已停止');
      }

      const { questions, selectedAnswers, scorePerQuestion, duration, timeLeft, challengeId } = this.data;
      console.log('当前数据:', {
        questionsCount: questions.length,
        answersCount: Object.keys(selectedAnswers).length,
        scorePerQuestion,
        duration,
        timeLeft
      });
      
      // 统计答题结果
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;

      // 获取现有错题本
      let wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      
      // 统计答题结果
      questions.forEach((question, index) => {
        const userAnswer = selectedAnswers[index];
        if (userAnswer) {
          answeredCount++;
          if (userAnswer === question.answer) {
            correctCount++;
          } else {
            wrongCount++;
            
            // 构造错题对象
            const wrongQuestion = {
              ...question,
              userAnswer,
              addTime: new Date().getTime()
            };
            
            // 检查是否已存在该错题
            const existIndex = wrongQuestions.findIndex(q => q._id === question._id);
            
            if (existIndex === -1) {
              // 如果错题本达到200题，删除最早的错题
              if (wrongQuestions.length >= 200) {
                wrongQuestions.sort((a, b) => a.addTime - b.addTime);
                wrongQuestions.shift();
              }
              wrongQuestions.push(wrongQuestion);
            }
          }
        }
      });

      console.log('统计结果:', {
        correctCount,
        wrongCount,
        answeredCount
      });

      // 更新错题本
      wx.setStorageSync('wrongQuestions', wrongQuestions);

      // 计算得分
      const score = correctCount * scorePerQuestion;

      // 计算用时
      const timeUsed = duration * 60 - timeLeft;

      // 标记为已提交
      wx.setStorageSync(submitKey, {
        timestamp: Date.now(),
        score,
        correctCount,
        wrongCount,
        answeredCount,
        timeUsed,
        totalQuestions: questions.length
      });

      // 准备结果数据
      const result = {
        totalQuestions: questions.length,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        timeUsed,
        questions: questions.map((q, i) => ({
          ...q,
          userAnswer: selectedAnswers[i] || ''
        }))
      };

      console.log('准备保存的结果:', result);

      // 保存结果
      wx.setStorageSync('challengeResult', result);
      console.log('结果已保存到本地存储');

      // 更新用户积分（每答对一题得1分）
      const app = getApp();
      if (app.globalData.isLogin && correctCount > 0) {
        try {
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
            const newPoints = currentPoints + correctCount; // 每答对一题加1分
            const newSignDays = Math.floor(newPoints / 20); // 每20积分算一天

            // 更新用户数据
            await db.collection('users').doc(user._id).update({
              data: {
                points: newPoints,
                signDays: newSignDays,
                lastAnswerTime: db.serverDate(),
                // 更新答题统计
                totalQuestions: _.inc(questions.length),
                correctQuestions: _.inc(correctCount),
                wrongQuestions: _.inc(wrongCount),
                correctRate: _.set(((user.correctQuestions + correctCount) / (user.totalQuestions + questions.length) * 100).toFixed(1))
              }
            });

            // 添加积分记录
            await db.collection('dailyPoints').add({
              data: {
                phoneNumber: app.globalData.userInfo.phoneNumber,
                points: correctCount,
                type: 'challenge',
                date: db.serverDate(),
                description: `挑战模式答对${correctCount}题`
              }
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

            // 显示获得积分的提示
            wx.showToast({
              title: `答对${correctCount}题\n获得${correctCount}积分！`,
              icon: 'none',
              duration: 2000
            });
          }
        } catch (err) {
          console.error('更新积分失败:', err);
        }
      }

      // 跳转到结果页面
      console.log('准备跳转到结果页面');
      wx.redirectTo({
        url: '/pages/challenge-result/challenge-result',
        success: () => {
          console.log('跳转成功');
        },
        fail: (error) => {
          console.error('跳转失败:', error);
        }
      });

    } catch (error) {
      console.error('提交失败:', error);
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
      console.log('提交流程结束');
    }
  }
});