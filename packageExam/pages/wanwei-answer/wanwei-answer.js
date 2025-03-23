const app = getApp();

Page({
  data: {
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedAnswers: [],
    showAnswer: false,
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showSettings: false,
    showAnswerCard: false,
    examId: null,
    startIndex: 0,
    endIndex: 0,
    isSubmitting: false
  },

  calculateQuestionRange(examId) {
    const wanweiConfig = require('../../../config/wanwei');
    const exam = wanweiConfig.examList.find(e => e.id === examId);
    if (!exam) return null;

    const questionCount = exam.questionCount;
    const startIndex = (exam.id - 1) * 50;
    const endIndex = startIndex + questionCount - 1;

    return {
      startIndex,
      endIndex,
      questionCount
    };
  },

  async onLoad(options) {
    const { examId } = options;
    if (!examId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    const range = this.calculateQuestionRange(Number(examId));
    if (!range) {
      wx.showToast({
        title: '试卷不存在',
        icon: 'none'
      });
      return;
    }

    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    
    this.setData({
      examId: Number(examId),
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      darkMode,
      isFavorite: false
    });

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });

    await this.loadQuestions();
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
    wx.showLoading({
      title: '加载题目中...',
      mask: true
    });

    try {
      const { examId } = this.data;
      let questions = [];
      let range = {
        start: this.data.startIndex + 1,
        end: this.data.endIndex + 1
      };

      console.log('开始加载试卷' + examId);
      const db = wx.cloud.database();
      
      // 分批获取题目
      const batchSize = 20;
      const batchCount = Math.ceil(50 / batchSize);
      
      for (let i = 0; i < batchCount; i++) {
        const skip = (range.start - 1) + (i * batchSize);
        const limit = Math.min(batchSize, 50 - (i * batchSize));
        
        if (limit <= 0) break;
        
        const { data } = await db.collection('wanwei')
          .skip(skip)
          .limit(limit)
          .get();
          
        questions = [...questions, ...data];
        
        if (data.length < limit) break;
      }

      console.log('查询结果：', questions);

      if (!questions || questions.length === 0) {
        console.error('未找到题目数据');
        wx.showModal({
          title: '加载失败',
          content: '未找到题目数据，请检查数据库配置',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
        return;
      }

      // 只取前50题
      questions = questions.slice(0, 50);

      // 初始化答题数据
      await this.initializeQuestionData(questions);

      console.log('题目加载完成，共', questions.length, '道题');

    } catch (error) {
      console.error('加载题目失败:', error);
      wx.showModal({
        title: '加载失败',
        content: '题目加载失败，请稍后重试',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    } finally {
      wx.hideLoading();
    }
  },

  async initializeQuestionData(questions) {
    // 格式化题目数据
    const formattedQuestions = questions.map((q, index) => ({
      序号: index + 1,
      title: q.title,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      answer: q.answer,
      type: '万维调考',
      isFavorite: false,
      options: {
        A: q.optionA,
        B: q.optionB,
        C: q.optionC,
        D: q.optionD
      }
    }));

    const selectedAnswers = new Array(formattedQuestions.length).fill('');

    this.setData({
      questions: formattedQuestions,
      currentQuestion: formattedQuestions[0],
      selectedAnswers,
      currentIndex: 0
    });

    // 检查第一题的收藏状态
    this.checkFavoriteStatus();
  },

  handleOptionTap(e) {
    const { option } = e.currentTarget.dataset;
    const { currentIndex, selectedAnswers, autoNext } = this.data;
    
    // 更新选中答案
    const newSelectedAnswers = [...selectedAnswers];
    newSelectedAnswers[currentIndex] = option;
    
    this.setData({
      selectedAnswers: newSelectedAnswers
    });

    // 如果开启了自动下一题且不是最后一题
    if (autoNext && currentIndex < this.data.questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 500);
    }
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex]
      });
      this.checkFavoriteStatus();
    }
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questions[prevIndex]
      });
      this.checkFavoriteStatus();
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

  preventBubble() {
    // 阻止冒泡
  },

  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswerCard: false
    });
    this.checkFavoriteStatus();
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

  async submitExam() {
    const { selectedAnswers, questions, isSubmitting } = this.data;
    
    if (isSubmitting) {
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查是否有未答题目
    const unansweredCount = selectedAnswers.filter(answer => !answer).length;
    
    if (unansweredCount > 0) {
      wx.showModal({
        title: '提示',
        content: `还有 ${unansweredCount} 题未作答，确定要提交吗？`,
        success: (res) => {
          if (res.confirm) {
            this.calculateResult();
          }
        }
      });
    } else {
      this.calculateResult();
    }
  },

  async calculateResult() {
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
            type: '万维调考',
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

      // 保存答题数据到本地存储，按照结算页面要求的格式
      const examData = {
        questions: questions.map((q, index) => ({
          index: index + 1,
          title: q.title,
          options: {
            A: q.optionA || q.A,
            B: q.optionB || q.B,
            C: q.optionC || q.C,
            D: q.optionD || q.D
          },
          correctAnswer: q.answer,
          userAnswer: selectedAnswers[index] || '未作答',
          isCorrect: selectedAnswers[index] === q.answer,
          source: '万维调考'
        })),
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        mode: 'wanwei',
        timestamp: Date.now()
      };

      console.log('准备保存的考试数据:', examData);
      
      // 先保存数据
      wx.setStorageSync('currentExamData', examData);
      
      // 验证数据是否保存成功
      const savedData = wx.getStorageSync('currentExamData');
      console.log('验证保存的数据:', savedData);

      if (!savedData || !savedData.questions) {
        console.error('数据保存失败');
        wx.showToast({
          title: '数据保存失败，请重试',
          icon: 'none'
        });
        this.setData({ isSubmitting: false });
        return;
      }

      // 更新统计数据
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const totalCorrect = wx.getStorageSync('correctCount') || 0;
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
      wx.setStorageSync('correctCount', totalCorrect + correctCount);

      wx.hideLoading();

      // 使用navigateTo而不是reLaunch，这样可以保持页面栈
      wx.navigateTo({
        url: `/packageExam/pages/wanwei-result/wanwei-result?` +
             `score=${score}&` +
             `correctCount=${correctCount}&` +
             `wrongCount=${wrongCount}&` +
             `answeredCount=${answeredCount}&` +
             `totalQuestions=${questions.length}&` +
             `mode=wanwei`,
        success: () => {
          // 重置提交状态
          this.setData({ isSubmitting: false });
          // 再次验证数据
          const finalData = wx.getStorageSync('currentExamData');
          console.log('跳转后验证数据:', finalData);
        },
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '提交失败，请重试',
            icon: 'none'
          });
          // 重置提交状态
          this.setData({ isSubmitting: false });
        }
      });

    } catch (err) {
      console.error('计算结果失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
      // 重置提交状态
      this.setData({ isSubmitting: false });
    }
  },

  checkFavoriteStatus() {
    const { currentQuestion } = this.data;
    if (!currentQuestion) return;
    
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    const isFavorite = favoriteQuestions.some(q => q.序号 === currentQuestion.序号);
    
    this.setData({ isFavorite });
  },

  toggleFavorite() {
    const { currentQuestion, currentIndex, questions } = this.data;
    let favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    
    const isFavorite = !currentQuestion.isFavorite;
    
    if (isFavorite) {
      // 添加到收藏
      if (!favoriteQuestions.some(q => q.序号 === currentQuestion.序号)) {
        favoriteQuestions.push(currentQuestion);
      }
    } else {
      // 从收藏中移除
      favoriteQuestions = favoriteQuestions.filter(q => q.序号 !== currentQuestion.序号);
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
      currentQuestion: updatedQuestions[currentIndex],
      isFavorite
    });
    
    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'success'
    });
  },

  onUnload() {
    // 清理考试相关的缓存
    wx.removeStorageSync('examQuestions');
    wx.removeStorageSync('selectedAnswers');
    wx.removeStorageSync('currentExamData');
  }
}); 