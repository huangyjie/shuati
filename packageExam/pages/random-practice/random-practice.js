const app = getApp();

Page({
  data: {
    currentQuestion: null,
    userAnswer: '',
    showAnswer: false,
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    isLastQuestion: false,
    isCorrect: false,
    selectedAnswers: {},
    correctAnswers: {}, // 添加正确答案记录
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showAnswerCard: false,
    showSettings: false,
    isSubmitting: false,
    hasAnswered: {},
    mode: ''
  },

  onLoad(options) {
    // 设置答题模式
    this.setData({
      mode: options.mode || ''
    });
    
    this.initQuestions();
    
    // 加载夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
  },

  async initQuestions() {
    try {
      wx.showLoading({
        title: '加载题目中...'
      });

      const db = wx.cloud.database();
      const { total } = await db.collection('questions').count();
      
      if (total === 0) {
        throw new Error('题库为空');
      }

      // 随机获取20道题目（每日答题）或50道题目（其他模式）
      const questionCount = this.data.mode === 'daily' ? 20 : 50;
      const randomQuestions = [];
      const selectedIndexes = new Set();

      while (randomQuestions.length < questionCount) {
        const randomIndex = Math.floor(Math.random() * total);
        if (!selectedIndexes.has(randomIndex)) {
          selectedIndexes.add(randomIndex);
          const { data } = await db.collection('questions')
            .skip(randomIndex)
            .limit(1)
            .get();
            
          if (data && data.length > 0) {
            randomQuestions.push(data[0]);
          }
        }
      }

      this.setData({
        questions: randomQuestions,
        currentQuestion: randomQuestions[0],
        currentIndex: 0,
        totalQuestions: randomQuestions.length,
        loading: false,
        selectedAnswers: {}, // 重置答案记录
        correctAnswers: {}, // 重置正确答案记录
        hasAnswered: {} // 重置作答记录
      });

      wx.hideLoading();
    } catch (err) {
      console.error('加载题目失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  shuffleArray(array) {
    let currentIndex = array.length;
    let randomIndex;

    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  },

  handleOptionTap(e) {
    if (this.data.showAnswer) return;

    const selectedAnswer = e.currentTarget.dataset.option;
    const isCorrect = selectedAnswer === this.data.currentQuestion.answer;

    // 记录答案和正确性
    const selectedAnswers = { ...this.data.selectedAnswers };
    const correctAnswers = { ...this.data.correctAnswers };
    const hasAnswered = { ...this.data.hasAnswered };
    
    selectedAnswers[this.data.currentIndex] = selectedAnswer;
    correctAnswers[this.data.currentIndex] = isCorrect;
    hasAnswered[this.data.currentIndex] = true;

    this.setData({
      selectedAnswer,
      showAnswer: true,
      isCorrect,
      selectedAnswers,
      correctAnswers,
      hasAnswered
    });

    // 如果开启了自动下一题
    if (this.data.autoNext) {
      setTimeout(() => {
        if (this.data.currentIndex < this.data.questions.length - 1) {
          this.nextQuestion();
        } else if (this.data.autoSubmit) {
          this.submitExam();
        }
      }, 1000);
    }
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex],
        showAnswer: false,
        selectedAnswer: '',
        isCorrect: false,
        isLastQuestion: nextIndex === this.data.questions.length - 1
      });
    }
  },

  calculateResult() {
    const { selectedAnswers, questions, hasAnswered, correctAnswers } = this.data;
    let correctCount = 0;
    let wrongCount = 0;
    let score = 0;
    
    // 只统计已作答的题目
    Object.keys(hasAnswered).forEach(index => {
      if (hasAnswered[index]) {
        if (correctAnswers[index]) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const answeredCount = Object.keys(hasAnswered).length;
    score = Math.round((correctCount / questions.length) * 100);

    return {
      score,
      correctCount,
      wrongCount,
      answeredCount,
      totalQuestions: questions.length
    };
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questions[prevIndex],
        showAnswer: false,
        selectedAnswer: '',
        isCorrect: false
      });
    }
  },

  goBack() {
    const { questions, selectedAnswers, hasAnswered } = this.data;
    const answeredCount = Object.keys(hasAnswered).length;
    
    // 如果已经答题但未完成，显示提示
    if (answeredCount > 0 && answeredCount < questions.length) {
      wx.showModal({
        title: '提示',
        content: '当前答题数据不会保存，确定要退出吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  submitExam: async function() {
    // 检查是否正在提交中，如果是则直接返回
    if (this.data.isSubmitting) {
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否已经提交过
    const submitKey = `random_practice_${this.data.mode}_${new Date().toLocaleDateString()}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showToast({
        title: '已经提交过了',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 设置提交状态为true
    this.setData({ isSubmitting: true });
    
    try {
      // 立即标记为已提交，防止重复提交
      wx.setStorageSync(submitKey, true);
      
      const { questions, selectedAnswers, hasAnswered, correctAnswers } = this.data;
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;

      // 统计答题结果
      Object.keys(hasAnswered).forEach(index => {
        if (hasAnswered[index]) {
          answeredCount++;
          if (correctAnswers[index]) {
            correctCount++;
          } else {
            wrongCount++;
          }
        }
      });

      // 计算得分
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
            type: this.data.mode || '随机练习',
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
          source: this.data.mode || '随机练习'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        mode: this.data.mode || 'random-practice',
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
             `mode=${this.data.mode || 'random-practice'}`
      });

    } catch (err) {
      console.error('提交失败:', err);
      wx.showToast({
        title: '提交失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  onUnload() {
    // 清理提交状态
    const submitKey = `random_practice_${this.data.mode}_${new Date().toLocaleDateString()}_submitted`;
    wx.removeStorageSync(submitKey);
    
    // 清理考试数据缓存
    wx.removeStorageSync('examData');
    
    // 取消返回提示
    wx.disableAlertBeforeUnload();
  },

  onShow() {
    // 监听左上角返回按钮和安卓物理返回键
    wx.enableAlertBeforeUnload({
      message: '当前答题数据不会保存，确定要退出吗？'
    });
  },

  onHide() {
    // 取消返回提示
    wx.disableAlertBeforeUnload();
  },

  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
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

  toggleAnswerCard() {
    console.log('切换答题卡显示状态');
    this.setData({
      showAnswerCard: !this.data.showAnswerCard
    });
  },

  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    console.log('跳转到题目:', index);
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswer: false,
      selectedAnswer: '',
      isCorrect: false,
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

  handleAnswer(e) {
    const selectedAnswer = e.currentTarget.dataset.option;
    const { currentIndex, autoNext, autoSubmit, questions } = this.data;
    const currentQuestion = questions[currentIndex];
    const isCorrect = selectedAnswer === currentQuestion.answer;

    this.setData({
      [`selectedAnswers.${currentIndex}`]: selectedAnswer,
      showAnswer: true,
      isCorrect
    });

    if (!isCorrect) {
      // 构造错题对象
      const wrongQuestion = {
        ...currentQuestion,
        userAnswer: selectedAnswer,
        addTime: new Date().getTime()
      };

      // 获取本地错题本
      let wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      
      // 检查是否已存在该题
      const existIndex = wrongQuestions.findIndex(q => q.序号 === currentQuestion.序号);
      
      if (existIndex === -1) {
        // 如果错题本达到2000题，删除最早添加的错题
        if (wrongQuestions.length >= 2000) {
          wrongQuestions.sort((a, b) => a.addTime - b.addTime);
          wrongQuestions.shift();
        }
        
        // 加新错题
        wrongQuestions.push(wrongQuestion);
        wx.setStorageSync('wrongQuestions', wrongQuestions);
        
        console.log('随机练习 - 新增错题:', wrongQuestion);
        console.log('随机练习 - 当前错题本总数:', wrongQuestions.length);
        
        wx.showToast({
          title: '已加入错题本',
          icon: 'success'
        });
      }

      // 当错题接近上限时提醒用户
      if (wrongQuestions.length >= 180) {
        wx.showToast({
          title: `错题本剩余空间${2000 - wrongQuestions.length}题`,
          icon: 'none',
          duration: 2000
        });
      }
    }

    // 自动下一题和提交的逻辑保持不变
    if (autoNext && currentIndex < questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    } else if (autoSubmit && currentIndex === questions.length - 1) {
      setTimeout(() => {
        this.submitExam();
      }, 1000);
    }

    // 更新每日任务进度
    const today = new Date().toLocaleDateString();
    const dailyTask = wx.getStorageSync('dailyTask') || { date: today, completedQuestions: 0 };
    
    if (dailyTask.date === today && dailyTask.completedQuestions < 20) {
      dailyTask.completedQuestions++;
      wx.setStorageSync('dailyTask', dailyTask);
      
      // 如果完成20题，更新签到值
      if (dailyTask.completedQuestions === 20) {
        this.updateSignValue();
      }
    }
  },

  async updateSignValue() {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      const today = new Date().toLocaleDateString();
      const userResult = await db.collection('users').where({
        _openid: wx.cloud.getWXContext().OPENID
      }).get();
      
      if (userResult.data.length > 0) {
        const user = userResult.data[0];
        const lastSignDate = user.lastSignDate;
        
        // 检查是否连续签到
        const isConsecutive = lastSignDate === new Date(Date.now() - 86400000).toLocaleDateString();
        
        await db.collection('users').doc(user._id).update({
          data: {
            signDays: isConsecutive ? _.inc(1) : 1,
            lastSignDate: today
          }
        });
        
        wx.showToast({
          title: '获得1点签到值',
          icon: 'success'
        });
      }
    } catch (err) {
      console.error('更新签到值失败:', err);
    }
  },

  async updateUserStats(correctCount, totalQuestions) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const _ = db.command;
      
      // 获取用户信息
      if (app.globalData.userInfo?.phoneNumber) {
        const { data: users } = await db.collection('users')
          .where({
            phoneNumber: app.globalData.userInfo.phoneNumber
          })
          .get();

        if (users.length > 0) {
          await db.collection('users').doc(users[0]._id).update({
            data: {
              totalQuestions: _.inc(totalQuestions),
              correctQuestions: _.inc(correctCount),
              correctRate: Math.round((correctCount / totalQuestions) * 100),
              updateTime: db.serverDate()
            }
          });
        }
      }
    } catch (err) {
      console.error('更新用户统计失败:', err);
    }
  }
}); 