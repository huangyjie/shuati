// pages/favorites-practice/favorites-practice.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedAnswer: '',
    showAnswer: false,
    answered: false,
    isCorrect: false,
    darkMode: false,
    isUploading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
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

    // 检查本地收藏数据
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    
    // 如果本地没有数据，尝试从云端恢复
    if (favoriteQuestions.length === 0) {
      await this.autoRestoreFromCloud();
    } else {
      // 如果有本地数据，正常加载并上传到云端
      this.autoUploadToCloud(favoriteQuestions);
      this.loadFavoriteQuestions();
    }
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

    // 每次显示页面时自动上传收藏题目
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    this.autoUploadToCloud(favoriteQuestions);
  },

  loadFavoriteQuestions() {
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
    if (favoriteQuestions.length === 0) {
      wx.showToast({
        title: '暂无收藏题目',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({
      questions: favoriteQuestions,
      currentQuestion: favoriteQuestions[0],
      currentIndex: 0
    });

    // 自动上传到云端
    this.autoUploadToCloud(favoriteQuestions);
  },

  handleOptionSelect(e) {
    if (this.data.answered) return;
    
    const { option } = e.currentTarget.dataset;
    const { currentQuestion } = this.data;
    const isCorrect = option === currentQuestion.answer;

    this.setData({
      selectedAnswer: option,
      showAnswer: true,
      answered: true,
      isCorrect
    });

    // 更新答题统计
    const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
    wx.setStorageSync('totalAnswered', totalAnswered + 1);
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questions[nextIndex],
        selectedAnswer: '',
        showAnswer: false,
        answered: false
      });
    }
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questions[prevIndex],
        selectedAnswer: '',
        showAnswer: false,
        answered: false
      });
    }
  },

  toggleFavorite() {
    const { currentQuestion, questions, currentIndex } = this.data;
    
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏这道题目吗？',
      success: async (res) => {
        if (res.confirm) {
          // 从收藏列表中移除当前题目
          let favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
          favoriteQuestions = favoriteQuestions.filter(q => q.序号 !== currentQuestion.序号);
          wx.setStorageSync('favoriteQuestions', favoriteQuestions);

          // 从云端也删除这道题
          await this.removeFromCloud(currentQuestion);

          // 更新页面数据
          const newQuestions = questions.filter(q => q.序号 !== currentQuestion.序号);
          
          if (newQuestions.length === 0) {
            this.setData({
              questions: [],
              currentQuestion: null
            });
            return;
          }

          // 调整当前题目索引
          const newIndex = currentIndex >= newQuestions.length ? newQuestions.length - 1 : currentIndex;
          
          this.setData({
            questions: newQuestions,
            currentIndex: newIndex,
            currentQuestion: newQuestions[newIndex],
            selectedAnswer: '',
            showAnswer: false,
            answered: false
          });

          wx.showToast({
            title: '已取消收藏',
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

      // 获取当前云端收藏题目
      const { data } = await db.collection('user_favorite_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        const cloudQuestions = data[0].questions.filter(q => 
          q.序号 !== question.序号
        );

        // 更新云端收藏题目
        await db.collection('user_favorite_questions').doc(data[0]._id).update({
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
      const { data } = await db.collection('user_favorite_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        // 更新现有记录
        await db.collection('user_favorite_questions').doc(data[0]._id).update({
          data: {
            questions: questions,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('user_favorite_questions').add({
          data: {
            phoneNumber,
            questions: questions,
            updateTime: db.serverDate()
          }
        });
      }
    } catch (error) {
      console.error('自动上传收藏题目失败:', error);
    } finally {
      this.setData({ isUploading: false });
    }
  },

  // 自动从云端恢复数据
  async autoRestoreFromCloud() {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) {
        this.loadFavoriteQuestions();
        return;
      }

      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      const { data } = await db.collection('user_favorite_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0 && data[0].questions && data[0].questions.length > 0) {
        // 从云端恢复到本地
        const favoriteQuestions = data[0].questions;
        wx.setStorageSync('favoriteQuestions', favoriteQuestions);
        
        this.setData({
          questions: favoriteQuestions,
          currentQuestion: favoriteQuestions[0] || null,
          currentIndex: 0,
          selectedAnswer: '',
          showAnswer: false,
          answered: false
        });

        wx.showToast({
          title: '已从云端恢复',
          icon: 'success'
        });
      } else {
        // 如果云端也没有数据，则正常加载空数据
        this.loadFavoriteQuestions();
      }
    } catch (error) {
      console.error('自动从云端恢复失败:', error);
      // 如果恢复失败，则正常加载本地数据
      this.loadFavoriteQuestions();
    }
  },

  // 清空云端收藏题目
  async clearCloudFavorites() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空云端收藏题目吗？此操作不可恢复。',
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
            const { data } = await db.collection('user_favorite_questions')
              .where({ phoneNumber })
              .get();

            if (data.length > 0) {
              // 更新为空数组
              await db.collection('user_favorite_questions').doc(data[0]._id).update({
                data: {
                  questions: [],
                  updateTime: db.serverDate()
                }
              });

              // 同时清空本地收藏题目
              wx.setStorageSync('favoriteQuestions', []);
              
              // 更新页面数据
              this.setData({
                questions: [],
                currentQuestion: null,
                currentIndex: 0,
                selectedAnswer: '',
                showAnswer: false,
                answered: false
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
            console.error('清空云端收藏题目失败:', error);
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

      const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];
      const db = wx.cloud.database();
      const phoneNumber = app.globalData.userInfo.phoneNumber;

      // 查询是否已有记录
      const { data } = await db.collection('user_favorite_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0) {
        // 更新现有记录
        await db.collection('user_favorite_questions').doc(data[0]._id).update({
          data: {
            questions: favoriteQuestions,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('user_favorite_questions').add({
          data: {
            phoneNumber,
            questions: favoriteQuestions,
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
      console.error('上传收藏题目失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      });
    }
  },

  // 手动从云端恢复数据
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

      const { data } = await db.collection('user_favorite_questions')
        .where({ phoneNumber })
        .get();

      if (data.length > 0 && data[0].questions && data[0].questions.length > 0) {
        // 从云端恢复到本地
        const favoriteQuestions = data[0].questions;
        wx.setStorageSync('favoriteQuestions', favoriteQuestions);
        
        this.setData({
          questions: favoriteQuestions,
          currentQuestion: favoriteQuestions[0] || null,
          currentIndex: 0,
          selectedAnswer: '',
          showAnswer: false,
          answered: false
        });

        wx.hideLoading();
        wx.showToast({
          title: '恢复成功',
          icon: 'success'
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '云端无数据',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('从云端恢复失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
    }
  }
})