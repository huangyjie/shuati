const app = getApp();

Page({
  data: {
    iconBaseUrl: app.globalData.iconBaseUrl,
    darkMode: false,
    searchKeyword: '',
    searchHistory: [],
    questions: [],
    searched: false,
    optionLabels: ['A', 'B', 'C', 'D'], // 选项标签
  },

  onLoad() {
    // 获取深色模式设置
    const darkMode = wx.getStorageSync('darkMode') || false;
    // 获取搜索历史
    const searchHistory = wx.getStorageSync('searchHistory') || [];
    
    this.setData({ 
      darkMode,
      searchHistory
    });
  },

  // 输入框输入事件
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 清空搜索框
  clearSearch() {
    this.setData({
      searchKeyword: '',
      questions: [],
      searched: false
    });
  },

  // 执行搜索
  async onSearch() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '搜索中...',
      mask: true
    });

    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 定义题库名称映射
      const collectionNames = {
        'questions': '综合题库',
        'hardware': '硬件题库',
        'Base': '基础题库',
        'Internet': '互联网题库',
        'Software': '软件题库',
        'Xinchuang': '信创题库',
        'wanwei': '万维题库'
      };
      
      const collections = ['questions', 'hardware', 'Base', 'Internet', 'Software', 'Xinchuang', 'wanwei'];
      let allQuestions = [];

      for (const collection of collections) {
        const { data } = await db.collection(collection)
          .where(_.or([
            {
              title: db.RegExp({
                regexp: keyword,
                options: 'i'
              })
            },
            {
              optionA: db.RegExp({
                regexp: keyword,
                options: 'i'
              })
            },
            {
              optionB: db.RegExp({
                regexp: keyword,
                options: 'i'
              })
            },
            {
              optionC: db.RegExp({
                regexp: keyword,
                options: 'i'
              })
            },
            {
              optionD: db.RegExp({
                regexp: keyword,
                options: 'i'
              })
            }
          ]))
          .field({
            _id: true,
            title: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            answer: true,
            type: true
          })
          .limit(100)
          .get();
        
        // 添加题库来源信息
        const questionsWithSource = data.map(q => ({
          ...q,
          source: collectionNames[collection]
        }));
        
        allQuestions = [...allQuestions, ...questionsWithSource];
      }

      // 更新搜索历史
      let searchHistory = this.data.searchHistory;
      if (!searchHistory.includes(keyword)) {
        searchHistory = [keyword, ...searchHistory].slice(0, 10);
        wx.setStorageSync('searchHistory', searchHistory);
      }

      this.setData({
        questions: allQuestions,
        searchHistory,
        searched: true
      });

    } catch (err) {
      console.error('搜索失败:', err);
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    }

    wx.hideLoading();
  },

  // 点击历史记录
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      searchKeyword: keyword
    }, () => {
      this.onSearch();
    });
  },

  // 清空历史记录
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('searchHistory', []);
          this.setData({
            searchHistory: []
          });
        }
      }
    });
  },

  // 点击题目
  onQuestionTap(e) {
    const questionId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/question-detail/question-detail?id=${questionId}`,
      fail: (err) => {
        console.error('跳转到题目详情页失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 处理反馈点击
  onFeedback(e) {
    const question = e.currentTarget.dataset.question;
    const feedbackTypeMap = {
      'content': '题目内容有误',
      'answer': '答案有误',
      'options': '选项有误',
      'other': '其他问题'
    };
    
    wx.showActionSheet({
      itemList: Object.values(feedbackTypeMap),
      success: (res) => {
        const feedbackTypes = Object.keys(feedbackTypeMap);
        const feedbackType = feedbackTypeMap[feedbackTypes[res.tapIndex]];
        
        if (feedbackType === '答案有误') {
          wx.showActionSheet({
            itemList: ['选项A', '选项B', '选项C', '选项D'],
            success: (answerRes) => {
              const userAnswer = `用户选项${['A', 'B', 'C', 'D'][answerRes.tapIndex]}`;
              this.submitFeedback(question, feedbackType, userAnswer);
            }
          });
        } else if (feedbackType === '其他问题') {
          // 其他问题时弹出输入框
          wx.showModal({
            title: '问题说明',
            content: '请描述具体问题',
            editable: true,
            placeholderText: '请输入问题说明',
            success: (inputRes) => {
              if (inputRes.confirm && inputRes.content.trim()) {
                this.submitFeedback(question, feedbackType, '', inputRes.content.trim());
              } else if (inputRes.confirm) {
                wx.showToast({
                  title: '请输入问题说明',
                  icon: 'none'
                });
              }
            }
          });
        } else {
          this.submitFeedback(question, feedbackType);
        }
      }
    });
  },

  // 新增提交反馈的函数
  async submitFeedback(question, feedbackType, userAnswer = '', description = '') {
    wx.showModal({
      title: '问题反馈',
      content: '确认提交反馈吗？我们会尽快核实处理',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '提交中...',
            mask: true
          });
          
          try {
            const db = wx.cloud.database();
            await db.collection('feedback').add({
              data: {
                questionId: question._id,
                questionTitle: question.title,
                feedbackType: feedbackType,
                source: question.source,
                currentAnswer: `正确答案${question.answer}`,
                suggestedAnswer: userAnswer,
                description: description,  // 添加问题说明字段
                createTime: db.serverDate()
              }
            });
            
            wx.showToast({
              title: '反馈成功',
              icon: 'success'
            });
          } catch (err) {
            console.error('提交反馈失败:', err);
            wx.showToast({
              title: '提交失败',
              icon: 'error'
            });
          }
          
          wx.hideLoading();
        }
      }
    });
  }
}); 