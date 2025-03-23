Page({
  data: {
    wrongQuestions: [],
    currentIndex: 0,
    currentQuestion: null,
    userAnswers: [],
    showResult: false,
    isCorrect: false,
    disabled: false,
    darkMode: false,
    remaining: 2000,
    isUploading: false,
    // AI相关数据
    showAIPanel: false,
    messages: [],
    lastMessageId: '',
    // 配置API密钥 - 开源版本已移除
    aiConfig: {
      apiKey: '', // 请替换为您的AI API密钥
      model: 'kimi' // 默认使用的模型，可选值: kimi, gpt等
    },
    showSettings: false,
    autoClearCorrect: false,
    isFavorited: false,
  },

  async onLoad(options) {
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

    // 检查本地错题数据
    const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];

    // 如果本地没有数据，尝试从云端恢复
    if (wrongQuestions.length === 0) {
      await this.autoRestoreFromCloud();
    } else {
      // 如果有本地数据，正常加载并上传到云端
      this.autoUploadToCloud(wrongQuestions);
      this.loadWrongQuestions();
    }

    // 获取自动清理设置
    const autoClearCorrect = wx.getStorageSync('autoClearCorrect') || false;
    this.setData({ autoClearCorrect });
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

  async loadWrongQuestions() {
    try {
      let wrongQuestions = wx.getStorageSync('wrongQuestions') || [];

      if (wrongQuestions.length === 0) {
        wx.showToast({
          title: '暂无错题记录',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      // 有本地错题时，自动上传到云端
      await this.autoUploadToCloud(wrongQuestions);

      const remaining = 2000 - wrongQuestions.length;

      wrongQuestions.sort((a, b) => b.addTime - a.addTime);

      this.setData({
        wrongQuestions,
        currentIndex: 0,
        currentQuestion: wrongQuestions[0],
        userAnswers: [],
        showResult: false,
        disabled: false,
        remaining
      });

      // 更新全局错题统计
      wx.setStorageSync('totalWrong', wrongQuestions.length);

      // 检查当前题目是否已被收藏
      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const isFavorited = favoriteQuestions.some(q => q.序号 === wrongQuestions[0].序号);
      this.setData({ isFavorited });

    } catch (err) {
      console.error('加载错题失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  showCurrentQuestion() {
    if (this.data.wrongQuestions.length > 0) {
      const question = this.data.wrongQuestions[this.data.currentIndex];
      this.setData({
        currentQuestion: question,
        showResult: false,
        disabled: false,
        isFavorited: (function () {
          const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
          return Array.isArray(favoriteQuestions) && favoriteQuestions.some(q => q.序号 === question.序号);
        })()
      });
    }
  },

  handlePrevious() {
    if (this.data.currentIndex > 0) {
      this.setData({
        currentIndex: this.data.currentIndex - 1
      }, () => {
        this.showCurrentQuestion();
      });
    } else {
      wx.showToast({
        title: '已经是第一题了',
        icon: 'none'
      });
    }
  },

  handleNext() {
    if (this.data.currentIndex < this.data.wrongQuestions.length - 1) {
      this.setData({
        currentIndex: this.data.currentIndex + 1
      }, () => {
        this.showCurrentQuestion();
      });
    } else {
      wx.showToast({
        title: '已经是最后一题了',
        icon: 'none'
      });
    }
  },

  async handleAnswer(e) {
    const { option } = e.currentTarget.dataset;
    const { currentQuestion, currentIndex, wrongQuestions } = this.data;

    const isCorrect = option === currentQuestion.answer;

    this.setData({
      showResult: true,
      isCorrect,
      disabled: true,
      [`userAnswers[${currentIndex}]`]: {
        userAnswer: option,
        isCorrect
      }
    });

    // 如果答对了，从错题本中移除
    if (isCorrect) {
      // 检查是否开启了自动清理
      if (this.data.autoClearCorrect) {
        const updatedQuestions = wrongQuestions.filter((q, idx) => idx !== currentIndex);
        wx.setStorageSync('wrongQuestions', updatedQuestions);

        // 从云端也删除这道题
        await this.removeFromCloud(currentQuestion);

        // 更新UI和统计
        this.setData({
          wrongQuestions: updatedQuestions,
          remaining: 2000 - updatedQuestions.length
        });

        // 如果当前题目是最后一题，索引减1
        if (currentIndex === updatedQuestions.length) {
          this.setData({
            currentIndex: Math.max(0, currentIndex - 1)
          });
        }

        // 更新当前题目
        this.showCurrentQuestion();

        wx.showToast({
          title: '已从错题本移除',
          icon: 'success'
        });
      }
    }
  },

  handleRestart() {
    wx.showModal({
      title: '提示',
      content: '确定要重新开始错题练习吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            currentIndex: 0,
            userAnswers: [],
            showResult: false,
            disabled: false
          }, () => {
            this.showCurrentQuestion();
          });

          wx.showToast({
            title: '已重新开始',
            icon: 'success'
          });
        }
      }
    });
  },

  // 从云端移除题目
  async removeFromCloud(question) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      // 获取当前云端错题本
      const { data } = await db.collection('user_wrong_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        const cloudQuestions = data[0].questions.filter(q =>
          q.title !== question.title ||
          q.answer !== question.answer
        );

        // 更新云端错题本
        await db.collection('user_wrong_questions').doc(data[0]._id).update({
          data: {
            questions: cloudQuestions,
            updateTime: db.serverDate()
          }
        });
      }
    } catch (error) {
      console.error('从云端移除题目失败:', error);
    }
  },

  // 自动上传到云端
  async autoUploadToCloud(questions) {
    if (this.data.isUploading) return;

    try {
      this.setData({ isUploading: true });

      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      // 查询是否已有记录
      const { data } = await db.collection('user_wrong_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        // 更新现有记录
        await db.collection('user_wrong_questions').doc(data[0]._id).update({
          data: {
            questions: questions,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('user_wrong_questions').add({
          data: {
            phoneNumber,
            questions: questions,
            updateTime: db.serverDate()
          }
        });
      }
    } catch (error) {
      console.error('自动上传错题本失败:', error);
    } finally {
      this.setData({ isUploading: false });
    }
  },

  // 从云端恢复错题本
  async restoreFromCloud() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '正在恢复...',
        mask: true
      });

      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      const { data } = await db.collection('user_wrong_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0 && data[0].questions && data[0].questions.length > 0) {
        // 从云端恢复到本地
        const wrongQuestions = data[0].questions;
        wx.setStorageSync('wrongQuestions', wrongQuestions);

        // 更新页面数据
        this.setData({
          wrongQuestions: wrongQuestions,
          currentQuestion: wrongQuestions[0] || null,
          currentIndex: 0,
          userAnswers: [],
          showResult: false,
          disabled: false,
          remaining: 2000 - wrongQuestions.length
        });

        // 更新全局错题统计
        wx.setStorageSync('totalWrong', wrongQuestions.length);

        // 显示成功提示
        wx.showToast({
          title: '恢复成功',
          icon: 'success'
        });

        // 重新加载题目
        this.showCurrentQuestion();
      } else {
        wx.showToast({
          title: '云端无数据',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('从云端恢复错题本失败:', error);
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 清空云端错题本
  async clearCloudWrongBook() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空云端错题本吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const app = getApp();
            if (!app.globalData.isLogin) {
              wx.showToast({
                title: '请先登录',
                icon: 'none'
              });
              return;
            }

            wx.showLoading({
              title: '正在清空...',
              mask: true
            });

            const db = wx.cloud.database();
            const phoneNumber = app.globalData.userInfo.phoneNumber;

            // 查询是否有记录
            const { data } = await db.collection('user_wrong_questions')
              .where({ phoneNumber })
              .get();

            if (data.length > 0) {
              // 更新为空数组
              await db.collection('user_wrong_questions').doc(data[0]._id).update({
                data: {
                  questions: [],
                  updateTime: db.serverDate()
                }
              });

              // 同时清空本地错题本
              wx.setStorageSync('wrongQuestions', []);

              // 更新页面数据
              this.setData({
                wrongQuestions: [],
                currentIndex: 0,
                currentQuestion: null,
                userAnswers: [],
                showResult: false,
                disabled: false,
                remaining: 2000
              });

              wx.showToast({
                title: '云端已清空',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: '云端无数据',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('清空云端错题本失败:', error);
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 手动上传到云端
  async uploadToCloud() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '正在上传...',
        mask: true
      });

      const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      // 查询是否已有记录
      const { data } = await db.collection('user_wrong_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        // 更新现有记录
        await db.collection('user_wrong_questions').doc(data[0]._id).update({
          data: {
            questions: wrongQuestions,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('user_wrong_questions').add({
          data: {
            phoneNumber,
            questions: wrongQuestions,
            updateTime: db.serverDate()
          }
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: '上传成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('上传错题本失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      });
    }
  },

  // AI相关方法
  toggleAIPanel() {
    this.setData({
      showAIPanel: !this.data.showAIPanel
    });
  },

  async askQuestion(e) {
    const questionType = e.currentTarget.dataset.type;
    const { currentQuestion } = this.data;
    
    if (!currentQuestion) {
      wx.showToast({
        title: '请先选择题目',
        icon: 'none'
      });
      return;
    }
    
    let prompt;
    if (questionType === 'explain') {
      prompt = `请详细解释以下计算机题目，包括概念讲解和答案分析：\n${currentQuestion.title}\nA: ${currentQuestion.optionA}\nB: ${currentQuestion.optionB}\nC: ${currentQuestion.optionC}\nD: ${currentQuestion.optionD}\n正确答案：${currentQuestion.answer}`;
    } else {
      prompt = `请给出这道题目的解题思路，不要直接告诉我答案：\n${currentQuestion.title}\nA: ${currentQuestion.optionA}\nB: ${currentQuestion.optionB}\nC: ${currentQuestion.optionC}\nD: ${currentQuestion.optionD}`;
    }
    
    const result = await this.sendToAI(prompt);
    
    // 更新消息列表
    const messages = [...this.data.messages];
    messages.push({
      role: 'user',
      content: prompt
    });
    
    messages.push({
      role: 'assistant',
      content: result
    });
    
    this.setData({
      messages,
      lastMessageId: `msg-${messages.length - 1}`
    });
  },

  sendCurrentQuestion() {
    const { currentQuestion } = this.data;
    if (!currentQuestion) return;
    
    this.askQuestion({
      currentTarget: {
        dataset: {
          type: 'explain'
        }
      }
    });
  },

  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  async sendToAI(prompt) {
    try {
      // 检查API密钥是否已配置
      if (!this.data.aiConfig.apiKey) {
        wx.showToast({
          title: '请先配置您的API密钥',
          icon: 'none'
        });
        return '请在代码中配置您的AI服务API密钥后再使用此功能';
      }

      // 这里是调用AI服务的代码
      // 实际开发中，应将API调用逻辑放在云函数中执行，以保护API密钥
      
      // 示例返回
      return '这是一个示例分析结果。在实际使用中，您需要配置自己的AI API并实现调用逻辑。';
    } catch (err) {
      console.error('AI分析错误:', err);
      return '分析失败，请稍后再试';
    }
  },

  // 自动从云端恢复数据
  async autoRestoreFromCloud() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        this.loadWrongQuestions();
        return;
      }

      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      const { data } = await db.collection('user_wrong_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0 && data[0].questions && data[0].questions.length > 0) {
        // 从云端恢复到本地
        const wrongQuestions = data[0].questions;
        wx.setStorageSync('wrongQuestions', wrongQuestions);

        // 更新页面数据
        this.setData({
          wrongQuestions: wrongQuestions,
          currentQuestion: wrongQuestions[0] || null,
          currentIndex: 0,
          userAnswers: [],
          showResult: false,
          disabled: false,
          remaining: 2000 - wrongQuestions.length
        });

        // 更新全局错题统计
        wx.setStorageSync('totalWrong', wrongQuestions.length);

        // 显示成功提示
        wx.showToast({
          title: '已从云端恢复',
          icon: 'success'
        });

        // 重新加载题目
        this.showCurrentQuestion();
      } else {
        // 如果云端也没有数据，则正常加载空数据
        this.loadWrongQuestions();
      }
    } catch (error) {
      console.error('自动从云端恢复失败:', error);
      // 如果恢复失败，则正常加载本地数据
      this.loadWrongQuestions();
    }
  },

  // 一键复制错题本
  async copyWrongQuestions() {
    try {
      const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      if (wrongQuestions.length === 0) {
        wx.showToast({
          title: '暂无错题可复制',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '正在处理...',
        mask: true
      });

      // 生成错题文本
      const content = wrongQuestions.map((q, index) => {
        return `${index + 1}. ${q.title}\n` +
          `A. ${q.optionA}\n` +
          `B. ${q.optionB}\n` +
          `C. ${q.optionC}\n` +
          `D. ${q.optionD}\n` +
          `正确答案: ${q.answer}\n`;
      }).join('\n');

      // 复制到剪贴板
      await wx.setClipboardData({
        data: content
      });

      // 显示建议提示
      wx.showModal({
        title: '复制成功',
        content: '错题本已复制到剪贴板。建议使用电脑打开文档编辑器(如Word、记事本等)后粘贴查看，以获得更好的阅读体验。',
        showCancel: false,
        confirmText: '我知道了'
      });

    } catch (err) {
      console.error('复制错题失败:', err);
      wx.showToast({
        title: '复制失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 复制当前题目
  copyCurrentQuestion() {
    const { currentQuestion } = this.data;
    if (!currentQuestion) return;

    const content =
      `${currentQuestion.title}\n` +
      `A. ${currentQuestion.optionA}\n` +
      `B. ${currentQuestion.optionB}\n` +
      `C. ${currentQuestion.optionC}\n` +
      `D. ${currentQuestion.optionD}\n` +
      `正确答案: ${currentQuestion.answer}`;

    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制当前题目',
          icon: 'success'
        });
      }
    });
  },

  // 显示设置面板
  showSettings() {
    this.setData({ showSettings: true });
  },

  // 隐藏设置面板
  hideSettings() {
    this.setData({ showSettings: false });
  },

  // 切换自动清理设置
  toggleAutoClear(e) {
    const autoClearCorrect = e.detail.value;
    this.setData({ autoClearCorrect });
    wx.setStorageSync('autoClearCorrect', autoClearCorrect);

    wx.showToast({
      title: autoClearCorrect ? '已开启自动清理' : '已关闭自动清理',
      icon: 'success'
    });
  },

  // 手动清理已答对的题目
  async clearCorrectQuestions() {
    const { wrongQuestions } = this.data;

    wx.showModal({
      title: '确认清理',
      content: '确定要清理所有已答对的题目吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          // 过滤出未答对的题目
          const remainingQuestions = wrongQuestions.filter(q =>
            !this.data.userAnswers.find(a =>
              a.questionId === q._id && a.isCorrect
            )
          );

          // 更新本地存储
          wx.setStorageSync('wrongQuestions', remainingQuestions);

          // 更新云端存储
          if (getApp().globalData.isLogin) {
            await this.uploadToCloud(remainingQuestions);
          }

          // 更新页面数据
          this.setData({
            wrongQuestions: remainingQuestions,
            currentIndex: 0,
            currentQuestion: remainingQuestions[0] || null,
            userAnswers: [],
            showResult: false,
            disabled: false,
            remaining: 2000 - remainingQuestions.length
          });

          wx.showToast({
            title: '清理完成',
            icon: 'success'
          });
        }
      }
    });
  },

  // 阻止事件冒泡
  preventBubble() { },

  toggleFavorite() {
    const { currentQuestion } = this.data;
    let favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];

    const isFavorited = favoriteQuestions.some(q => q.序号 === currentQuestion.序号);

    if (isFavorited) {
      // 取消收藏
      favoriteQuestions = favoriteQuestions.filter(q => q.序号 !== currentQuestion.序号);
      wx.setStorageSync('favoriteQuestions', favoriteQuestions);
      wx.showToast({ title: '已取消收藏', icon: 'success' });
    } else {
      // 收藏
      favoriteQuestions.push(currentQuestion);
      wx.setStorageSync('favoriteQuestions', favoriteQuestions);
      wx.showToast({ title: '已收藏', icon: 'success' });
    }

    // 更新收藏状态
    this.setData({ isFavorited: !isFavorited });
  },

  async analyzeWrongQuestions() {
    const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
    if (wrongQuestions.length === 0) {
      wx.showToast({ title: '错题本为空', icon: 'none' });
      return;
    }

    const prompt = '请分析以下错题并总结不足之处：\n' + wrongQuestions.map(q => `题目：${q.title}，答案：${q.answer}，选项：A. ${q.optionA} B. ${q.optionB} C. ${q.optionC} D. ${q.optionD}`).join('\n');

    const analysisResult = await this.sendToAI(prompt);
    wx.showModal({
      title: 'AI分析结果',
      content: analysisResult,
      showCancel: false
    });
  },
}); 