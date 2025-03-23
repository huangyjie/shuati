const app = getApp()
const db = wx.cloud.database()
const _ = db.command
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    darkMode: false,
    developers: [],
    developerLoading: false,
    showDeveloperModal: false,
    editingDeveloper: {},
    defaultAvatarUrl
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    })
    
    // 设置导航栏颜色
    this.updateNavigationBarColor();
    
    this.loadDevelopers()
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

  async loadDevelopers() {
    try {
      this.setData({ developerLoading: true })
      
      const { data } = await db.collection('developers')
        .orderBy('order', 'asc')
        .get()

      // 为每个开发者添加QQ头像URL
      const developers = data.map(dev => ({
        ...dev,
        avatar: `https://q1.qlogo.cn/g?b=qq&nk=${dev.qq}&s=640`
      }))
      
      this.setData({
        developers,
        developerLoading: false
      })
    } catch (error) {
      console.error('加载开发者列表失败：', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ developerLoading: false })
    }
  },

  showAddDeveloper() {
    this.setData({
      showDeveloperModal: true,
      editingDeveloper: {
        name: '',
        role: '',
        qq: '',
        description: '',
        order: this.data.developers.length // 默认排在最后
      }
    })
  },

  editDeveloper(e) {
    const developer = e.currentTarget.dataset.developer
    this.setData({
      showDeveloperModal: true,
      editingDeveloper: { ...developer }
    })
  },

  handleDeveloperInput(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({
      [`editingDeveloper.${field}`]: value
    })
  },

  async saveDeveloper() {
    const { _id, name, role, qq, description, order } = this.data.editingDeveloper
    
    if (!name || !role || !qq || !description) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    try {
      if (_id) {
        // 更新
        await db.collection('developers').doc(_id).update({
          data: {
            name,
            role,
            qq,
            description,
            order: Number(order) || 0,
            updateTime: db.serverDate()
          }
        })
      } else {
        // 新增
        await db.collection('developers').add({
          data: {
            name,
            role,
            qq,
            description,
            order: Number(order) || 0,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      this.loadDevelopers()
      this.closeDeveloperModal()
    } catch (error) {
      console.error('保存开发者信息失败：', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  async deleteDeveloper(e) {
    const developerId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该开发者吗？此操作不可恢复！',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('developers').doc(developerId).remove()

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            
            this.loadDevelopers()
          } catch (error) {
            console.error('删除开发者失败：', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  closeDeveloperModal() {
    this.setData({
      showDeveloperModal: false,
      editingDeveloper: {}
    })
  },

  preventBubble() {
    // 阻止事件冒泡
  },

  async onPullDownRefresh() {
    await this.loadDevelopers()
    wx.stopPullDownRefresh()
  }
}) 