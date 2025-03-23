// 章节练习答题页
Page({
  data: {
    currentQuestion: null,
    userAnswer: '',
    showAnswer: false,
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    isLastQuestion: false,
    answered: false,
    isCorrect: false,
    selectedAnswers: {},
    autoNext: false,
    darkMode: false,
    showSettings: false,
    showAnswerCard: false,
    loading: true,
    chapterId: '',
    collectionId: '',
    isSubmitting: false
  },

  async onLoad(options) {
    const { chapterId, collectionId } = options;
    
    if (!chapterId || !collectionId) {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    
    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    if (!authInfo || !authInfo.isLogin || !authInfo.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先在综合页面登录后再答题',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }

    // 加载题目
    console.log('从云数据库加载章节题目，集合:', collectionId);
    this.setData({ 
      chapterId,
      collectionId,
      userInfo: authInfo.userInfo,
      loading: true
    });
    
    await this.loadQuestions();
    
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ 
      darkMode,
      loading: false
    });
  },

  // 加载题目
  async loadQuestions() {
    wx.showLoading({
      title: '加载题目...',
      mask: true
    });

    try {
      const { collectionId } = this.data;
      const db = wx.cloud.database();
      const _ = db.command;
      
      console.log('正在从集合加载章节题目:', collectionId);
      
      // 先获取题目总数
      const countResult = await db.collection(collectionId).count();
      const total = countResult.total;
      
      if (total === 0) {
        throw new Error('该章节暂无题目');
      }

      // 生成50个不重复的随机索引
      const randomIndexes = [];
      const targetCount = Math.min(50, total); // 如果题目总数少于50，则全部选择
      
      while (randomIndexes.length < targetCount) {
        const randomIndex = Math.floor(Math.random() * total);
        if (!randomIndexes.includes(randomIndex)) {
          randomIndexes.push(randomIndex);
        }
      }

      // 获取随机题目
      const tasks = randomIndexes.map(index => 
        db.collection(collectionId).skip(index).limit(1).get()
      );

      const results = await Promise.all(tasks);
      const questions = results
        .map(res => res.data[0])
        .filter(q => q) // 过滤掉可能的空值
        .map((q, index) => ({
          序号: index + 1,
          title: q.title || q.question || '',
          optionA: q.optionA || q.A || '',
          optionB: q.optionB || q.B || '',
          optionC: q.optionC || q.C || '',
          optionD: q.optionD || q.D || '',
          answer: q.answer || '',
          type: this.data.collectionId
        }));

      console.log('获取到的随机题目:', questions);

      if (questions.length === 0) {
        throw new Error('获取题目失败');
      }

      this.setData({
        questions,
        currentQuestion: questions[0],
        totalQuestions: questions.length,
        loading: false
      });

      wx.hideLoading();
    } catch (err) {
      console.error('加载题目失败:', err);
      wx.hideLoading();
      
      wx.showModal({
        title: '加载失败',
        content: err.message || '加载题目失败，请稍后重试',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 处理选项点击
  handleOptionTap(e) {
    if (this.data.answered) return;
    
    const { option } = e.currentTarget.dataset;
    const { currentIndex, currentQuestion, autoNext } = this.data;
    
    // 更新选中的答案
    const selectedAnswers = { ...this.data.selectedAnswers };
    selectedAnswers[currentIndex] = option;
    
    this.setData({
      selectedAnswers,
      answered: true
    });

    // 如果开启了自动下一题，延迟后自动跳转
    if (autoNext && currentIndex < this.data.questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 800);
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex],
        answered: false,
        showAnswer: false
      });
    }
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questions[prevIndex],
        answered: false,
        showAnswer: false
      });
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

  // 防止答题卡内容点击穿透
  preventBubble() {
    return;
  },

  // 跳转到指定题目
  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswerCard: false,
      answered: false,
      showAnswer: false
    });
  },

  // 切换自动下一题
  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
  },

  // 切换夜间模式
  toggleDarkMode(e) {
    const darkMode = e.detail.value;
    this.setData({ darkMode });
    wx.setStorageSync('darkMode', darkMode);
    
    const app = getApp();
    if (app.toggleDarkMode) {
      app.toggleDarkMode(darkMode);
    }
  },

  // 提交答题结果
  submitChapter() {
    if (!this.data.answered) {
      wx.showModal({
        title: '提示',
        content: '当前题目未作答，确定要提交吗？',
        success: (res) => {
          if (res.confirm) {
            this.doSubmit();
          }
        }
      });
      return;
    }
    this.doSubmit();
  },

  // 执行提交
  doSubmit: async function() {
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
    const submitKey = `chapter_${this.data.chapterId}_${this.data.collectionId}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showToast({
        title: '已经提交过了',
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
        chapterId: this.data.chapterId,
        collectionId: this.data.collectionId
      });
      
      const { questions, selectedAnswers } = this.data;
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;

      // 获取现有答题统计
      let totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      let totalCorrect = wx.getStorageSync('correctCount') || 0;
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
              序号: question.序号,
              title: question.title,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              answer: question.answer,
              userAnswer: userAnswer,
              type: this.data.collectionId || '章节练习',
              addTime: new Date().getTime()
            };
            
            // 检查是否已存在该错题
            const existIndex = existingWrongQuestions.findIndex(q => 
              q.title === question.title && q.type === wrongQuestion.type
            );
            
            if (existIndex === -1) {
              // 如果错题本达到200题，删除最早的错题
              if (existingWrongQuestions.length >= 200) {
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
          source: this.data.collectionId || '章节练习'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        chapterId: this.data.chapterId,
        collectionId: this.data.collectionId,
        mode: 'chapter',
        timestamp: Date.now()
      };
      wx.setStorageSync('currentExamData', examData);

      // 更新统计数据
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
      wx.setStorageSync('correctCount', totalCorrect + correctCount);
      
      // 只有有错题时才更新错题本
      if (wrongCount > 0) {
        wx.setStorageSync('wrongQuestions', existingWrongQuestions);
      }

      // 跳转到结果页面
      wx.redirectTo({
        url: `/packageExam/pages/exam-result/exam-result?` +
             `score=${score}&` +
             `correctCount=${correctCount}&` +
             `wrongCount=${wrongCount}&` +
             `answeredCount=${answeredCount}&` +
             `totalQuestions=${questions.length}&` +
             `mode=chapter`
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

  // 在页面卸载时清理不需要的缓存
  onUnload() {
    // 清理提交状态
    const submitKey = `chapter_${this.data.chapterId}_${this.data.collectionId}_submitted`;
    wx.removeStorageSync(submitKey);
    
    // 清理考试数据缓存
    wx.removeStorageSync('examData');
  },
}); 