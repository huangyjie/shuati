// packageExam/pages/answer/answer.js

// 计算试卷题目范围
function calculateQuestionRange(paperId) {
  const startIndex = (paperId - 1) * 50;
  const endIndex = startIndex + 49;
  return {
    start: startIndex + 1,  // 题目序号从1开始
    end: endIndex + 1
  };
}

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
    autoNext: false,
    autoSubmit: false,
    darkMode: false,
    showAnswerCard: false,
    showSettings: false,
    loading: true,
    autoSave: false,
    isLogin: false,
    isFavorite: false,
    isSubmitting: false,  // 添加提交状态锁
    backMode: false  // 添加背题模式状态
  },

  async onLoad(options) {
    const { paperId, hasCache } = options;

    // 检查登录状态
    const authInfo = wx.getStorageSync('authInfo');
    console.log('authInfo:', authInfo);

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

    // 加载试卷
    console.log('加载试卷:', paperId, '是否有缓存:', hasCache);
    this.setData({
      paperId,
      hasCache: hasCache === 'true',
      userInfo: authInfo.userInfo
    });
    this.loadQuestions();

    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.updateNavigationBarColor();
  },

  // 添加授权检查方法
  checkAuth() {
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          this.setData({ isLogin: true });
        } else {
          this.setData({ isLogin: false });
          // 显示授权提示
          wx.showModal({
            title: '提示',
            content: '需要您的授权才能保存做题记录',
            confirmText: '去授权',
            success: (res) => {
              if (res.confirm) {
                // 打开授权页面
                wx.openSetting({
                  success: (res) => {
                    if (res.authSetting['scope.userInfo']) {
                      this.setData({ isLogin: true });
                    }
                  }
                });
              }
            }
          });
        }
      }
    });
  },

  // 添加格式化时间的方法
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}秒`;
  },

  // 加载题目
  async loadQuestions() {
    wx.showLoading({
      title: '加载题目...',
      mask: true
    });

    try {
      const { paperId, hasCache } = this.data;
      let questions = [];
      let range = calculateQuestionRange(paperId);
      const cacheKey = `paper_${paperId}_questions`;

      // 优先从本地缓存获取题目
      if (hasCache) {
        const cachedQuestions = wx.getStorageSync(cacheKey);
        if (cachedQuestions && cachedQuestions.length > 0) {
          console.log('从本地缓存加载题目');
          questions = cachedQuestions;
          // 更新最后访问时间
          wx.setStorageSync(`${cacheKey}_lastAccess`, Date.now());
        }
      }

      // 如果本地没有缓存，则从云数据库获取
      if (questions.length === 0) {
        console.log('从云数据库加载试卷' + paperId);
        const db = wx.cloud.database();

        // 分批获取50道题目
        const batchSize = 20;
        const batchCount = Math.ceil(50 / batchSize);

        for (let i = 0; i < batchCount; i++) {
          const skip = (range.start - 1) + (i * batchSize);
          const limit = Math.min(batchSize, 50 - (i * batchSize));

          if (limit <= 0) break;

          const { data } = await db.collection('questions')
            .skip(skip)
            .limit(limit)
            .get();

          questions = [...questions, ...data];

          if (data.length < limit) break;
        }

        // 将题目缓存到本地
        if (questions.length > 0) {
          // 检查并管理缓存空间
          this.clearCache();
          // 保存题目和访问时间
          wx.setStorageSync(cacheKey, questions);
          wx.setStorageSync(`${cacheKey}_lastAccess`, Date.now());
          console.log('题目已缓存到本地');
        }
      }

      if (!questions || questions.length === 0) {
        throw new Error('未找到题目');
      }

      // 只取前50题
      questions = questions.slice(0, 50);

      // 获取收藏题目列表
      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const favoriteIds = favoriteQuestions.map(q => q._id);

      // 处理题目数据
      const formattedQuestions = questions.map((q, index) => {
        // 找到题目字段（通常是除了选项和答案以外的字段）
        const questionFields = Object.keys(q).filter(key =>
          !['_id', '_openid', 'A', 'B', 'C', 'D', 'answer', 'optionA', 'optionB', 'optionC', 'optionD'].includes(key)
        );

        // 获取题目内容
        let title = '';
        for (const field of questionFields) {
          if (typeof q[field] === 'string' && q[field].length > 0 && field !== '序号') {
            title = q[field];
            break;
          }
        }

        // 如果没有找到题目内容，使用最后一个非空字段
        if (!title) {
          for (const field of questionFields) {
            if (q[field] && field !== '序号') {
              title = q[field];
              break;
            }
          }
        }

        return {
          序号: range.start + index,
          title: title,  // 题目内容
          optionA: q['A'] || q['optionA'] || '',  // 选项A
          optionB: q['B'] || q['optionB'] || '',  // 选项B
          optionC: q['C'] || q['optionC'] || '',  // 选项C
          optionD: q['D'] || q['optionD'] || '',  // 选项D
          answer: q['answer'] || '',  // 答案
          type: '计算机基础',
          isFavorite: favoriteIds.includes(q._id)
        };
      });

      this.setData({
        questions: formattedQuestions,
        currentQuestion: formattedQuestions[0],
        loading: false,
        isFavorite: formattedQuestions[0].isFavorite
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

  // 初始化目数据的方法
  async initializeQuestionData(paperId, questions) {
    if (!questions || questions.length === 0) return;

    const savedProgress = wx.getStorageSync(`exam${paperId}_progress`) || {};
    const lastIndex = savedProgress.lastAnsweredIndex || 0;
    const currentQuestion = questions[lastIndex];

    // 如果背题模式开启，自动选择第一题的正确答案
    const selectedAnswers = { ...this.data.selectedAnswers };
    if (this.data.backMode && lastIndex === 0) {
      selectedAnswers[0] = currentQuestion.answer;
    }

    this.setData({
      paperId,
      questions,
      currentIndex: lastIndex,
      currentQuestion,
      totalQuestions: questions.length,
      loading: false,
      selectedAnswers // 更新选中的答案
    });
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      const nextQuestion = this.data.questions[nextIndex];

      // 如果背题模式开启，自动选择下一题的正确答案
      if (this.data.backMode) {
        const selectedAnswers = { ...this.data.selectedAnswers };
        selectedAnswers[nextIndex] = nextQuestion.answer; // 自动选择下一题的正确答案
        this.setData({ selectedAnswers });
      }

      this.setData({
        currentIndex: nextIndex,
        currentQuestion: nextQuestion,
        selectedAnswers: { ...this.data.selectedAnswers },
        showAnswer: false,
        isCorrect: false,
        userAnswer: '',
        isLastQuestion: nextIndex === this.data.questions.length - 1
      });
      this.checkFavoriteStatus();
    }
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      const prevQuestion = this.data.questions[prevIndex];

      this.setData({
        currentIndex: prevIndex,
        currentQuestion: prevQuestion,
        selectedAnswers: { ...this.data.selectedAnswers },
        showAnswer: false,
        isCorrect: false,
        userAnswer: '',
        isLastQuestion: false
      });
      this.checkFavoriteStatus();
    }
  },

  // 在页面卸载时清理不需要的缓存
  onUnload() {
    // 清理提交状态
    const submitKey = `paper_${this.data.paperId}_submitted`;
    wx.removeStorageSync(submitKey);

    // 清理考试数据缓存
    wx.removeStorageSync('examData');
  },

  // 添加清除缓存的方法
  clearCache() {
    try {
      const keys = wx.getStorageInfoSync().keys;
      const cacheKeys = keys.filter(key => key.startsWith('paper_') && key.endsWith('_questions'));

      // 如果缓存的试卷数量超过20份，则清理最早的缓存
      if (cacheKeys.length > 20) {
        // 获取每个缓存的最后访问时间
        const cacheInfo = cacheKeys.map(key => {
          const lastAccess = wx.getStorageSync(`${key}_lastAccess`) || 0;
          return { key, lastAccess };
        });

        // 按最后访问时间排序
        cacheInfo.sort((a, b) => a.lastAccess - b.lastAccess);

        // 删除最早的缓存，直到剩下20份
        for (let i = 0; i < cacheInfo.length - 20; i++) {
          wx.removeStorageSync(cacheInfo[i].key);
          wx.removeStorageSync(`${cacheInfo[i].key}_lastAccess`);
        }
      }

      wx.showToast({
        title: '缓存已整理',
        icon: 'success'
      });
    } catch (err) {
      console.error('清理缓存失败:', err);
      wx.showToast({
        title: '清理缓存失败',
        icon: 'error'
      });
    }
  },

  // 处理选项点击
  handleOptionTap(e) {
    if (!this.data.currentQuestion) {
      console.error('当前题目数据为空');
      wx.showToast({
        title: '题目加载中...',
        icon: 'none'
      });
      return;
    }

    const { option } = e.currentTarget.dataset;
    const { currentIndex, currentQuestion, autoNext, backMode } = this.data;

    // 添加调试信息
    console.log('背题模式状态:', backMode);
    console.log('用户选择的选项:', option);

    // 更新选中的答案
    const selectedAnswers = { ...this.data.selectedAnswers };
    selectedAnswers[currentIndex] = option;

    // 判断答案是否正确
    const isCorrect = option === currentQuestion.answer;

    this.setData({
      selectedAnswers,
      userAnswer: option,
      isCorrect,
      showAnswer: true
    });

    // 如果背题模式开启，自动选择正确答案
    if (backMode) {
      selectedAnswers[currentIndex] = currentQuestion.answer;
      this.setData({
        selectedAnswers,
        userAnswer: currentQuestion.answer,
        isCorrect: true
      });
      console.log('自动选择正确答案:', currentQuestion.answer); // 添加调试信息
    }

    // 如果开启了自动下一题，延迟后自动跳转
    if (autoNext && currentIndex < this.data.questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    }
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
    this.updateNavigationBarColor();
  },

  // 保存进度
  saveProgress() {
    const { paperId, currentIndex, questions, selectedAnswers } = this.data;

    // 保存当前进度
    const progress = {
      lastAnsweredIndex: currentIndex,
      totalQuestions: questions.length,
      timestamp: new Date().getTime()
    };

    wx.setStorageSync(`exam${paperId}_progress`, progress);

    // 处理已答题的错题
    let wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
    let newWrongCount = 0;
    let answeredCount = 0;

    // 只处理已作答的题目
    Object.keys(selectedAnswers).forEach(index => {
      const userAnswer = selectedAnswers[index];
      if (userAnswer) {
        answeredCount++;
        const question = questions[index];

        if (userAnswer !== question.answer) {
          const wrongQuestion = {
            ...question,
            userAnswer: userAnswer,
            addTime: new Date().getTime()
          };

          const existIndex = wrongQuestions.findIndex(q => q.序号 === question.序号);

          if (existIndex === -1) {
            if (wrongQuestions.length >= 2000) {
              wrongQuestions.sort((a, b) => a.addTime - b.addTime);
              wrongQuestions.shift();
            }
            wrongQuestions.push(wrongQuestion);
            newWrongCount++;
          }
        }
      }
    });

    // 只有有新错题时才更新存储
    if (newWrongCount > 0) {
      wx.setStorageSync('wrongQuestions', wrongQuestions);
    }

    // 只更新实际作答的题目数量
    if (answeredCount > 0) {
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
    }

    wx.showToast({
      title: newWrongCount > 0 ? `已保存，新增${newWrongCount}道错题` : '已存',
      icon: 'success',
      duration: 1500,
      complete: () => {
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }, 1500);
      }
    });
  },

  // 只保存进度但不返回首页的方法
  saveProgressOnly() {
    const { paperId, currentIndex, questions, selectedAnswers } = this.data;

    // 保存当前进度
    const progress = {
      lastAnsweredIndex: currentIndex,
      totalQuestions: questions.length,
      timestamp: new Date().getTime()
    };

    wx.setStorageSync(`exam${paperId}_progress`, progress);

    // 处理已答题的错题
    let wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
    let newWrongCount = 0;
    let answeredCount = 0;

    // 只处理已作答的题目
    Object.keys(selectedAnswers).forEach(index => {
      const userAnswer = selectedAnswers[index];
      if (userAnswer) {
        answeredCount++;
        const question = questions[index];

        if (userAnswer !== question.answer) {
          const wrongQuestion = {
            ...question,
            userAnswer: userAnswer,
            addTime: new Date().getTime()
          };

          const existIndex = wrongQuestions.findIndex(q => q.序号 === question.序号);

          if (existIndex === -1) {
            if (wrongQuestions.length >= 2000) {
              wrongQuestions.sort((a, b) => a.addTime - b.addTime);
              wrongQuestions.shift();
            }
            wrongQuestions.push(wrongQuestion);
            newWrongCount++;
          }
        }
      }
    });

    // 只有有新错题时才更新存储
    if (newWrongCount > 0) {
      wx.setStorageSync('wrongQuestions', wrongQuestions);
    }

    // 只更新实际作答的题目数量
    if (answeredCount > 0) {
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      wx.setStorageSync('totalAnswered', totalAnswered + answeredCount);
    }
  },

  // 添加重置试卷方法
  resetPaper() {
    wx.showModal({
      title: '确认重置',
      content: '重置后将清除本章的题记录，重新开始答。确定要重置吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除当前试卷的答题记录
          wx.removeStorageSync(`exam${this.data.paperId}_answers`);
          // 清除当前试卷的进度
          wx.removeStorageSync(`exam${this.data.paperId}_progress`);

          // 置页面状态
          this.setData({
            currentIndex: 0,
            currentQuestion: this.data.questions[0],
            selectedAnswer: '',
            showAnswer: false,
            resultText: '',
            lastAnsweredIndex: 0
          });

          wx.showToast({
            title: '已重置',
            icon: 'success'
          });
        }
      }
    });
  },

  // 切换设面板显示状态
  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  // 阻止设置面板的点击事件冒泡
  preventBubble() {
    return;
  },

  // 修改授权处理方法
  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      const app = getApp();
      app.globalData.userInfo = e.detail.userInfo;
      app.globalData.isLogin = true;

      // 保存授权状态到本存储
      wx.setStorageSync('authInfo', {
        isLogin: true,
        userInfo: e.detail.userInfo
      });

      this.setData({ isLogin: true });

      wx.showToast({
        title: '授权成功',
        icon: 'success'
      });
    }
  },

  // 添加页面重新显示的处理
  onShow() {
    // 检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
    }

    // 重置答题状态
    const { currentIndex, questions } = this.data;
    if (questions && questions.length > 0) {
      this.setData({
        currentQuestion: questions[currentIndex],
        selectedAnswer: '',
        showAnswer: false,
        resultText: '',
        isCorrect: false,
        userAnswer: ''
      });
    }
  },

  // 跳转到指定题目
  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const question = this.data.questions[index];

    this.setData({
      currentIndex: index,
      currentQuestion: question,
      showAnswerCard: false,
      selectedAnswer: '',
      showAnswer: false,
      isCorrect: false,
      userAnswer: ''
    });
  },

  // 添加检查收藏状态的方法
  checkFavoriteStatus() {
    const { currentQuestion } = this.data;
    if (!currentQuestion) return;

    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    const isFavorite = favoriteQuestions.some(q => q._id === currentQuestion._id);

    this.setData({ isFavorite });
  },

  // 添加切换收藏状态的方法
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

    // 更新当前题目的收藏状
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

  // 添加加载章节题目的方法
  async loadChapterQuestions(startIndex, endIndex) {
    try {
      wx.showLoading({
        title: '加载题目中...',
      });

      const db = wx.cloud.database();
      const _ = db.command;

      console.log('加载章节题目，范围:', startIndex, '到', endIndex);

      // 查询指范围的题目
      const { data } = await db.collection('questions')
        .where({
          序号: _.gte(startIndex).and(_.lte(endIndex))
        })
        .orderBy('序号', 'asc')
        .get();

      if (!data || data.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '该章暂无题目',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => wx.navigateBack(), 2000);
        return;
      }

      // 获取收藏题目列表
      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const favoriteIds = favoriteQuestions.map(q => q._id);

      // 处理题目数
      const questions = data.map(q => ({
        ...q,
        isFavorite: favoriteIds.includes(q._id)
      }));

      this.setData({
        questions,
        currentQuestion: questions[0],
        currentIndex: 0,
        totalQuestions: questions.length,
        loading: false,
        isFavorite: questions[0].isFavorite
      });

      wx.hideLoading();
    } catch (error) {
      console.error('加载章节题目失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载题目失败',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => wx.navigateBack(), 2000);
    }
  },

  // 切换答题卡显示状态
  toggleAnswerCard() {
    this.setData({
      showAnswerCard: !this.data.showAnswerCard
    });
  },

  // 跳转到定题目
  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index,
      currentQuestion: this.data.questions[index],
      showAnswerCard: false
    });
  },

  // 修改提交方法
  submitExam: async function () {
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
    const submitKey = `paper_${this.data.paperId}_submitted`;
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
      wx.setStorageSync(submitKey, {
        timestamp: Date.now(),
        paperId: this.data.paperId
      });

      const { questions, selectedAnswers, paperId, userInfo } = this.data;

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
              序号: question.序号,
              title: question.title,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              answer: question.answer,
              userAnswer: userAnswer,
              type: question.type || '计算机基础',
              addTime: new Date().getTime()
            };

            // 检查是否已存在该错题
            const existIndex = existingWrongQuestions.findIndex(q =>
              q.title === question.title && q.type === wrongQuestion.type
            );

            if (existIndex === -1) {
              // 如果错题本达到200题，删除最早的错题
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
          source: q.type || '计算机基础'
        })),
        selectedAnswers,
        score,
        correctCount,
        wrongCount,
        answeredCount,
        totalQuestions: questions.length,
        paperId,
        mode: 'practice',
        timestamp: Date.now()
      };
      wx.setStorageSync('currentExamData', examData);

      // 只有有错题时才更新错题本
      if (wrongCount > 0) {
        wx.setStorageSync('wrongQuestions', existingWrongQuestions);
      }

      // 更新总答题数和正确数
      const currentTotalAnswered = wx.getStorageSync('totalAnswered') || 0;
      wx.setStorageSync('totalAnswered', currentTotalAnswered + answeredCount);

      // 更新正确题目数量
      const currentCorrectCount = wx.getStorageSync('correctCount') || 0;
      wx.setStorageSync('correctCount', currentCorrectCount + correctCount);

      // 准备保存到数据库的数据
      const saveData = {
        answers: selectedAnswers,
        chapterId: paperId.toString(),
        collectionId: paperId.toString(),
        correctCount: correctCount,
        nickName: userInfo.nickName || '',
        phone: userInfo.phoneNumber,
        score: score,
        submitTime: new Date().toISOString(),
        totalQuestions: questions.length,
        type: 'practice',
        wrongCount: wrongCount,
        unansweredCount: questions.length - answeredCount
      };

      console.log('准备保存到completedPapers，数据：', saveData);

      try {
        const db = wx.cloud.database();

        // 先检查是否已经完成过这套试卷
        const existingRecord = await db.collection('completedPapers')
          .where({
            phone: userInfo.phoneNumber,
            chapterId: paperId.toString()
          })
          .get();

        if (existingRecord.data.length > 0) {
          console.log('更新已存在的记录');
          await db.collection('completedPapers').doc(existingRecord.data[0]._id).update({
            data: saveData
          });
        } else {
          console.log('创建新记录');
          await db.collection('completedPapers').add({
            data: saveData
          });
        }

        // 获取页面栈
        const pages = getCurrentPages();
        // 找到练习页面
        const practicePage = pages.find(page => page.route === 'pages/practice/practice');
        if (practicePage) {
          console.log('找到练习页面，准备刷新');
          // 调用练习页面的刷新方法
          practicePage.loadCompletedPapers();
        }

        // 跳转到结果页面
        wx.redirectTo({
          url: `/packageExam/pages/exam-result/exam-result?` +
            `score=${score}&` +
            `correctCount=${correctCount}&` +
            `wrongCount=${wrongCount}&` +
            `answeredCount=${answeredCount}&` +
            `totalQuestions=${questions.length}&` +
            `mode=practice`
        });

      } catch (error) {
        console.error('保存到completedPapers失败：', error);
        wx.showToast({
          title: '保存记录失败',
          icon: 'none',
          duration: 2000
        });
      }

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

  // 更新导航栏颜色
  updateNavigationBarColor() {
    wx.setNavigationBarColor({
      frontColor: this.data.darkMode ? '#ffffff' : '#000000',
      backgroundColor: this.data.darkMode ? '#1f1f1f' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });
  },

  toggleBackMode(e) {
    this.setData({
      backMode: e.detail.value
    });
  }
});