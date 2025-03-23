const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    darkMode: false,
    userList: [],
    loading: true,
    showUserEditModal: false,
    showStatsEditModal: false,
    editingUser: {},
    editingStats: {},
    editingField: '',
    searchKeyword: '',
    searchTimer: null
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    })
    
    // 设置导航栏颜色
    this.updateNavigationBarColor();
    
    this.loadUserList()
  },

  onShow() {
    // 检查夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({ darkMode });
      this.updateNavigationBarColor();
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

  async loadUserList() {
    try {
      this.setData({ loading: true })
      
      const result = await db.collection('users')
        .orderBy('points', 'desc')
        .limit(20)
        .get()
      
      this.setData({
        userList: result.data,
        loading: false
      })
      
      wx.showToast({
        title: '加载完成',
        icon: 'success',
        duration: 1500
      })
    } catch (error) {
      console.error('加载用户列表失败：', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ loading: false })
    }
  },

  editUserInfo(e) {
    const user = e.currentTarget.dataset.user
    this.setData({
      showUserEditModal: true,
      editingUser: { ...user }
    })
  },

  handleUserInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`editingUser.${field}`]: e.detail.value
    })
  },

  async saveUserInfo() {
    const { _id, nickName, phoneNumber } = this.data.editingUser
    
    if (!nickName || !phoneNumber) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    try {
      await db.collection('users').doc(_id).update({
        data: {
          nickName,
          phoneNumber,
          updateTime: db.serverDate()
        }
      })

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      this.loadUserList()
      this.closeModal()
    } catch (error) {
      console.error('保存用户信息失败：', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  editUserStats(e) {
    const { user, field } = e.currentTarget.dataset
    this.setData({
      showStatsEditModal: true,
      editingStats: { ...user },
      editingField: field
    })
  },

  handleStatsInput(e) {
    const value = parseInt(e.detail.value) || 0
    this.setData({
      [`editingStats.${this.data.editingField}`]: value
    })
  },

  async saveUserStats() {
    const { _id } = this.data.editingStats
    const field = this.data.editingField
    const value = this.data.editingStats[field]

    if (value < 0) {
      wx.showToast({
        title: '数值不能为负',
        icon: 'none'
      })
      return
    }

    try {
      await db.collection('users').doc(_id).update({
        data: {
          [field]: value,
          updateTime: db.serverDate()
        }
      })

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      this.loadUserList()
      this.closeModal()
    } catch (error) {
      console.error('保存用户统计失败：', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  async resetUserData(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认重置',
      content: '确定要重置该用户的所有数据吗？\n包括：积分、签到、答题记录等',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('users').doc(userId).update({
              data: {
                points: 0,
                signDays: 0,
                totalQuestions: 0,
                correctQuestions: 0,
                wrongQuestions: 0,
                correctRate: 0,
                resetCount: 0,
                updateTime: db.serverDate()
              }
            })

            wx.showToast({
              title: '重置成功',
              icon: 'success'
            })
            
            this.loadUserList()
          } catch (error) {
            console.error('重置用户数据失败：', error)
            wx.showToast({
              title: '重置失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  async deleteUser(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该用户吗？此操作不可恢复！',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('users').doc(userId).remove()

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            
            this.loadUserList()
          } catch (error) {
            console.error('删除用户失败：', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  closeModal() {
    this.setData({
      showUserEditModal: false,
      showStatsEditModal: false,
      editingUser: {},
      editingStats: {},
      editingField: ''
    })
  },

  handleSearch(e) {
    const value = e.detail.value
    this.setData({ searchKeyword: value })

    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
    }

    const timer = setTimeout(() => {
      this.searchUsers(value)
    }, 500)

    this.setData({ searchTimer: timer })
  },

  async searchUsers(keyword) {
    if (!keyword) {
      await this.loadUserList()
      return
    }

    try {
      wx.showLoading({
        title: '搜索中...',
        mask: true
      })

      const searchCondition = _.or([
        {
          nickName: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        },
        {
          phoneNumber: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        }
      ])

      const result = await db.collection('users')
        .where(searchCondition)
        .orderBy('points', 'desc')
        .get()

      wx.hideLoading()

      this.setData({ 
        userList: result.data,
        loading: false
      })

      if (result.data.length === 0) {
        wx.showToast({
          title: '未找到匹配用户',
          icon: 'none',
          duration: 2000
        })
      }
    } catch (error) {
      console.error('搜索失败：', error)
      wx.hideLoading()
      wx.showToast({
        title: '搜索失败',
        icon: 'error'
      })
    }
  },

  clearSearch() {
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
    }
    
    this.setData({
      searchKeyword: '',
      loading: true
    })
    
    this.loadUserList()
  },

  async onPullDownRefresh() {
    await this.loadUserList()
    wx.stopPullDownRefresh()
  },

  preventBubble() {
    // 阻止事件冒泡
  }
}) 