Page({
  data: {
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedAnswer: '',
    showAnswer: false,
    isCorrect: false,
    darkMode: false,
    selectedAnswers: {},
    totalPoints: 0,
    userPoints: 0,
    isSubmitting: false,
    showSettings: false,
    showAnswerCard: false,
    autoNext: false,
    autoSubmit: false
  },

  onLoad() {
    // 从本地存储获取夜间模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    
    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: darkMode ? '#ffffff' : '#000000',
      backgroundColor: darkMode ? '#2d2d2d' : '#ffffff'
    });
    
    this.loadQuestions();
    this.loadUserPoints();
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

  // 加载50道随机题目
  async loadQuestions() {
    try {
      wx.showLoading({
        title: '加载题目中...'
      });

      const db = wx.cloud.database();
      const total = (await db.collection('questions').count()).total;
      
      // 生成50个不重复的随机索引
      const randomIndexes = [];
      while(randomIndexes.length < 50) {
        const randomIndex = Math.floor(Math.random() * total);
        if(!randomIndexes.includes(randomIndex)) {
          randomIndexes.push(randomIndex);
        }
      }

      // 获取随机题目
      const promises = randomIndexes.map(index => {
        return db.collection('questions')
          .skip(index)
          .limit(1)
          .get();
      });

      const results = await Promise.all(promises);
      const questions = results
        .map(res => res.data[0])
        .filter(Boolean);

      this.setData({
        questions,
        currentQuestion: questions[0],
        currentIndex: 0
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

  // 添加加载用户积分的方法
  async loadUserPoints() {
    try {
      const app = getApp();
      if (app.globalData.userInfo?.phoneNumber) {
        const db = wx.cloud.database();
        const { data: users } = await db.collection('users')
          .where({
            phoneNumber: app.globalData.userInfo.phoneNumber
          })
          .get();

        if (users.length > 0) {
          this.setData({
            userPoints: users[0].points || 0
          });
        }
      }
    } catch (err) {
      console.error('加载用户积分失败:', err);
    }
  },

  // 处理选项点击
  handleOptionTap(e) {
    if (this.data.showAnswer) return;

    const selectedAnswer = e.currentTarget.dataset.option;
    const { currentIndex, questions, autoNext, autoSubmit } = this.data;
    
    // 保存当前题目的答案
    const selectedAnswers = { ...this.data.selectedAnswers };
    selectedAnswers[currentIndex] = selectedAnswer;

    this.setData({
      selectedAnswer,
      selectedAnswers
    });

    // 如果开启了自动下一题且不是最后一题
    if (autoNext && currentIndex < questions.length - 1) {
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    }
    // 如果是最后一题且开启了自动提交
    else if (autoSubmit && currentIndex === questions.length - 1) {
      setTimeout(() => {
        this.submitExam();
      }, 1000);
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex],
        selectedAnswer: this.data.selectedAnswers[nextIndex] || '',
        showAnswer: false,
        isCorrect: false
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
        selectedAnswer: this.data.selectedAnswers[prevIndex] || '',
        showAnswer: false,
        isCorrect: false
      });
    }
  },

  // 提交按钮点击事件
  submitExam() {
    if (this.data.isSubmitting) {
      console.log('正在提交中，请勿重复点击');
      wx.showToast({
        title: '正在提交中...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否已经提交过
    const submitKey = `points_practice_${new Date().toLocaleDateString()}_submitted`;
    const hasSubmitted = wx.getStorageSync(submitKey);
    if (hasSubmitted) {
      wx.showToast({
        title: '已经提交过了',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否有未答题目
    const unansweredCount = this.data.questions.length - Object.keys(this.data.selectedAnswers).length;
    if (unansweredCount > 0) {
      wx.showModal({
        title: '提示',
        content: `还有${unansweredCount}道题未作答，确定要提交吗？`,
        success: (res) => {
          if (res.confirm) {
            this.doSubmit();
          }
        }
      });
    } else {
      this.doSubmit();
    }
  },

  // 执行提交
  async doSubmit() {
    try {
      if (this.data.isSubmitting) {
        console.log('正在提交中，请勿重复点击');
        wx.showToast({
          title: '正在提交中...',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      this.setData({ isSubmitting: true });
      
      wx.showLoading({
        title: '正在提交...',
        mask: true
      });
      
      const { questions, selectedAnswers, totalPoints } = this.data;
      let correctCount = 0;
      let wrongCount = 0;
      let answeredCount = 0;
      let wrongQuestions = [];

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
              序号: question._id || `daily_${Date.now()}_${index}`,
              title: question.title,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              answer: question.answer,
              userAnswer: userAnswer,
              addTime: new Date().getTime()
            };
            
            // 检查是否已存在该错题
            const existIndex = existingWrongQuestions.findIndex(q => 
              q.序号 === wrongQuestion.序号
            );
            
            if (existIndex === -1) {
              // 如果错题本达到200题，删除最早的错题
              if (existingWrongQuestions.length >= 200) {
                existingWrongQuestions.sort((a, b) => a.addTime - b.addTime);
                existingWrongQuestions.shift();
              }
              existingWrongQuestions.push(wrongQuestion);
            }
            wrongQuestions.push(wrongQuestion);
          }
        }
      });

      // 保存错题本
      if (wrongQuestions.length > 0) {
        wx.setStorageSync('wrongQuestions', existingWrongQuestions);
      }

      // 更新本地统计数据
      const existingTotalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const existingCorrectCount = wx.getStorageSync('correctCount') || 0;
      
      wx.setStorageSync('totalAnswered', existingTotalAnswered + answeredCount);
      wx.setStorageSync('correctCount', existingCorrectCount + correctCount);

      // 保存答题数据用于结果页面
      wx.setStorageSync('examQuestions', questions);
      wx.setStorageSync('selectedAnswers', selectedAnswers);

      // 所有操作成功后，再标记为已提交
      const submitKey = `points_practice_${new Date().toLocaleDateString()}_submitted`;
      wx.setStorageSync(submitKey, true);

      // 跳转到结果页面
      wx.hideLoading();
      wx.navigateTo({
        url: '/packageExam/pages/daily-result/daily-result',
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('提交答题失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 添加检查每日目标和签到方法
  async checkDailyGoalAndSign(isPassed) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const _ = db.command;

      // 获取今日进度
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyProgress = wx.getStorageSync('dailyProgress') || {};
      
      // 如果完成了20题且及格
      if (dailyProgress.completedCount >= 20 && isPassed) {
        // 获取用户信息
        const { data: users } = await db.collection('users')
          .where({
            phoneNumber: app.globalData.userInfo.phoneNumber
          })
          .get();

        if (users.length > 0) {
          const user = users[0];
          const lastSignDate = user.lastSignDate ? new Date(user.lastSignDate) : null;
          
          // 检查是否已经签到
          if (!lastSignDate || lastSignDate.toDateString() !== today.toDateString()) {
            // 检查是否连续签到
            const isConsecutive = lastSignDate && 
              (today.getTime() - lastSignDate.getTime()) === 86400000; // 24小时的毫秒数

            await db.collection('users').doc(user._id).update({
              data: {
                signDays: isConsecutive ? _.inc(1) : 1, // 连续签到则+1，否则重置为1
                lastSignDate: db.serverDate(),
                points: _.inc(10) // 签到奖励10积分
              }
            });

            wx.showToast({
              title: '完成每日目标！签到成功',
              icon: 'success',
              duration: 2000
            });

            // 更新本地存储的签到状态
            wx.setStorageSync('lastSignDate', today.toDateString());
          }
        }
      } else if (!isPassed) {
        wx.showToast({
          title: '未达到及格线，继续加油！',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      console.error('签到失败:', err);
    }
  },

  // 修改 updateUserStats 方法
  async updateUserStats(correctCount, wrongCount, points, isPassed) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const _ = db.command;

      // 获取今日日期
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 获取用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: app.globalData.userInfo.phoneNumber
        })
        .get();

      if (users.length > 0) {
        const user = users[0];

        try {
          // 检查今日是否已获得积分
          const { data: dailyPoints } = await db.collection('dailyPoints')
            .where({
              userId: user._id,
              date: _.gte(today)
            })
            .get();

          // 如果今天还没有获得积分且及格
          if (dailyPoints.length === 0 && isPassed) {
            try {
              // 添加今日积分记录
              await db.collection('dailyPoints').add({
                data: {
                  userId: user._id,
                  phoneNumber: user.phoneNumber,
                  points: points,
                  date: db.serverDate(),
                  type: 'daily_practice',
                  isPassed: true
                }
              });

              // 更新用户统计数据
              await db.collection('users').doc(user._id).update({
                data: {
                  totalQuestions: _.inc(20),
                  correctQuestions: _.inc(correctCount),
                  wrongQuestions: _.inc(wrongCount),
                  points: _.inc(points),
                  correctRate: Math.round((correctCount / 20) * 100),
                  lastAnswerTime: db.serverDate(),
                  passedDays: _.inc(1) // 增加及格天数统计
                }
              });

              wx.showToast({
                title: `及格！获得${points}积分！`,
                icon: 'success'
              });
            } catch (err) {
              console.error('添加积分记录失败:', err);
            }
          } else {
            // 今日已获得积分或未及格，只更新答题统计
            await db.collection('users').doc(user._id).update({
              data: {
                totalQuestions: _.inc(20),
                correctQuestions: _.inc(correctCount),
                wrongQuestions: _.inc(wrongCount),
                correctRate: Math.round((correctCount / 20) * 100),
                lastAnswerTime: db.serverDate()
              }
            });

            if (dailyPoints.length > 0) {
              wx.showToast({
                title: '今日积分已达上限',
                icon: 'none'
              });
            }
          }

          // 更新本地进度
          const dailyProgress = {
            date: today.toLocaleDateString(),
            completedCount: 20,
            isPassed: isPassed
          };
          wx.setStorageSync('dailyProgress', dailyProgress);

        } catch (err) {
          console.error('检查积分记录失败:', err);
        }
      }
    } catch (err) {
      console.error('更新用户统计失败:', err);
      wx.showToast({
        title: '更新统计失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 添加设置相关方法
  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    });
  },

  preventBubble() {
    return;
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

  // 添加答题卡相关方法
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
      selectedAnswer: this.data.selectedAnswers[index] || '',
      showAnswer: false,
      isCorrect: false,
      showAnswerCard: false
    });
  },

  // 添加跳转到错题本的方法
  goToWrongBook() {
    wx.navigateTo({
      url: '/pages/wrong/wrong',
      fail: (err) => {
        console.error('跳转错题本失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加切换自动下一题的方法
  toggleAutoNext(e) {
    this.setData({
      autoNext: e.detail.value
    });
  },

  // 添加切换自动交卷的方法
  toggleAutoSubmit(e) {
    this.setData({
      autoSubmit: e.detail.value
    });
  },

  onUnload() {
    // 清理提交状态
    const submitKey = `points_practice_${new Date().toLocaleDateString()}_submitted`;
    wx.removeStorageSync(submitKey);
    
    // 清理考试数据缓存
    wx.removeStorageSync('examQuestions');
    wx.removeStorageSync('selectedAnswers');
  }
}); 