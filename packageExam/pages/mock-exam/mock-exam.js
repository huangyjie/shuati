const app = getApp();

Page({
  data: {
    paperId: null,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedAnswers: {},
    remainingTime: 1800,
    timer: null,
    showConfirmSubmit: false,
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showAnswerCard: false,
    showSettings: false,
    loading: true,
    isSubmitting: false
  },

  onLoad(options) {
    const { mode } = options;
    const darkMode = app.globalData.darkMode;
    this.setData({ darkMode });

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
          remainingTime: 1800,
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

      // 获取题目总数
      const { total } = await db.collection('questions').count();
      console.log('题库总题数:', total);

      if (total === 0) {
        throw new Error('题库为空');
      }

      // 生成50个不重复的随机索引
      const randomIndexes = [];
      while (randomIndexes.length < 50) {
        const randomIndex = Math.floor(Math.random() * total);
        if (!randomIndexes.includes(randomIndex)) {
          randomIndexes.push(randomIndex);
        }
      }

      console.log('生成随机索引:', randomIndexes);

      // 分批获取题目
      const questions = [];
      for (let index of randomIndexes) {
        const { data } = await db.collection('questions')
          .skip(index)
          .limit(1)
          .get();

        if (data && data[0]) {
          questions.push(data[0]);
        }
      }

      console.log('获取到题目数量:', questions.length);

      if (questions.length === 0) {
        throw new Error('未获取到题目');
      }

      // 打乱题目顺序
      const shuffledQuestions = this.shuffleArray([...questions]);

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
    const app = getApp();
    const darkMode = app.globalData.darkMode;
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
    // 检查是否正在提交中
    if (this.data.isSubmitting) {
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 生成唯一的提交标识，使用题目的第一题和最后一题的标识组合
    const firstQuestion = this.data.questions[0];
    const lastQuestion = this.data.questions[this.data.questions.length - 1];
    const submitKey = `mock_exam_${firstQuestion._id}_${lastQuestion._id}_submitted`;

    // 检查是否已经提交过
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showToast({
        title: '本次模拟考试已提交过了',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showModal({
      title: '确认提交',
      content: '确定要提交答案吗？',
      success: (res) => {
        if (res.confirm) {
          // 再次检查提交状态
          if (this.data.isSubmitting) {
            wx.showToast({
              title: '正在提交中...',
              icon: 'none',
              duration: 2000
            });
            return;
          }

          // 再次检查是否已提交
          const hasSubmitted = wx.getStorageSync(submitKey);
          if (hasSubmitted) {
            wx.showToast({
              title: '本次模拟考试已提交过了',
              icon: 'none',
              duration: 2000
            });
            return;
          }

          this.calculateResult();
        }
      }
    });
  },

  onUnload() {
    // 清理定时器
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }

    // 清理考试数据缓存
    wx.removeStorageSync('examQuestions');
    wx.removeStorageSync('selectedAnswers');
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

  // 修改计算结果方法
  async calculateResult() {
    // 检查是否正在提交中
    if (this.data.isSubmitting) {
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 生成唯一的提交标识，使用题目的第一题和最后一题的标识组合
    const firstQuestion = this.data.questions[0];
    const lastQuestion = this.data.questions[this.data.questions.length - 1];
    const submitKey = `mock_exam_${firstQuestion._id}_${lastQuestion._id}_submitted`;

    // 检查是否已经提交过
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showToast({
        title: '本次模拟考试已提交过了',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      // 设置提交状态为true
      this.setData({ isSubmitting: true });

      // 立即标记为已提交，防止重复提交
      wx.setStorageSync(submitKey, {
        timestamp: Date.now(),
        remainingTime: this.data.remainingTime,
        firstQuestionId: firstQuestion._id,
        lastQuestionId: lastQuestion._id
      });

      const { questions, selectedAnswers } = this.data;
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;

      // 获取现有错题本
      let existingWrongQuestions = wx.getStorageSync('wrongQuestions') || [];

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
              序号: question._id || `mock_${Date.now()}_${index}`,
              title: question.title,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              answer: question.answer,
              userAnswer: userAnswer,
              type: '模拟考试',
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
        }
      });

      // 计算得分 - 改为百分制
      const score = Math.round((correctCount / questions.length) * 100);

      // 保存答题详情数据到本地存储，供结果页面使用
      const examData = {
        questions: questions.map(q => ({
          title: q.title,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          answer: q.answer,
          source: '模拟考试'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        remainingTime: this.data.remainingTime,
        mode: 'mock',
        timestamp: Date.now()
      };
      wx.setStorageSync('currentExamData', examData);

      // 更新错题本
      if (wrongCount > 0) {
        wx.setStorageSync('wrongQuestions', existingWrongQuestions);
      }

      // 更新本地统计数据
      const existingTotalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const existingCorrectCount = wx.getStorageSync('correctCount') || 0;

      // 更新总答题数和正确题数
      wx.setStorageSync('totalAnswered', existingTotalAnswered + answeredCount);
      wx.setStorageSync('correctCount', existingCorrectCount + correctCount);

      // 上传分数到排行榜
      const app = getApp();
      if (app.globalData.isLogin && app.globalData.userInfo) {
        try {
          const db = wx.cloud.database();

          // 添加考试记录到云数据库
          await db.collection('mockExams').add({
            data: {
              userId: app.globalData.userInfo._id,
              phoneNumber: app.globalData.userInfo.phoneNumber,
              nickName: app.globalData.userInfo.nickName,
              avatarUrl: app.globalData.userInfo.avatarUrl,
              score: score,
              correctCount: correctCount,
              wrongCount: wrongCount,
              answeredCount: answeredCount,
              totalQuestions: questions.length,
              submitTime: db.serverDate(),
              type: 'mock',
              correctRate: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0,
              remainingTime: this.data.remainingTime
            }
          });

          // 更新用户最高分和答题统计
          const { data: users } = await db.collection('users')
            .where({
              phoneNumber: app.globalData.userInfo.phoneNumber
            })
            .get();

          if (users.length > 0) {
            const user = users[0];
            await db.collection('users').doc(user._id).update({
              data: {
                highestScore: db.command.max([score, user.highestScore || 0]),
                totalQuestions: db.command.inc(answeredCount),
                correctQuestions: db.command.inc(correctCount),
                wrongQuestions: db.command.inc(wrongCount),
                lastExamTime: db.serverDate()
              }
            });
          }
        } catch (err) {
          console.error('上传分数失败:', err);
        }
      }

      // 跳转到结果页面
      wx.redirectTo({
        url: `/packageExam/pages/exam-result/exam-result?` +
          `score=${score}&` +
          `correctCount=${correctCount}&` +
          `wrongCount=${wrongCount}&` +
          `answeredCount=${answeredCount}&` +
          `totalQuestions=${questions.length}&` +
          `mode=mock`
      });

    } catch (err) {
      console.error('计算结果失败:', err);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
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