const app = getApp()
const db = wx.cloud.database()
const _ = db.command

// 格式化存储空间大小
function formatStorageSize(sizeInKB) {
  if (sizeInKB < 1024) {
    return `${sizeInKB}KB`
  } else if (sizeInKB < 1024 * 1024) {
    return `${(sizeInKB / 1024).toFixed(2)}MB`
  } else {
    return `${(sizeInKB / (1024 * 1024)).toFixed(2)}GB`
  }
}

Page({
  data: {
    darkMode: false,
    statistics: {
      totalUsers: 0,
      totalQuestions: 0,
      todayNewUsers: 0,
      todaySubmissions: 0,
      totalCollections: 0,
      totalDocuments: 0,
      totalStorage: '0KB',
      activeCollections: 0,
      chatMessages: 0,
      completedPapers: 0,
      userWrongQuestions: 0,
      userBreakthrough: 0,
      serBreakthrough: 0,
      feedbackCount: 0,
      todayFeedbackCount: 0
    }
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    })
    
    // 设置导航栏颜色
    this.updateNavigationBarColor();
    
    this.loadStatistics()
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

  // 加载统计数据
  async loadStatistics() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 定义所有用户提交记录集合
      const submissionCollections = [
        'completedPapers',    // 完成试卷
        'mockExams',          // 模拟考试
        'user_wrong_questions', // 错题记录
        'user_breakthrough',   // 用户突破
        'ser_breakthrough',    // 服务突破
        'dailyRecords',        // 每日记录
        'battle_records',      // 对战记录
        'breakthrough_records' // 突破记录
      ]

      // 使用Promise.all并行处理多个查询
      const [
        userCount,
        todayUserCount,
        ...submissionCounts
      ] = await Promise.all([
        db.collection('users').count(),
        db.collection('users')
          .where({
            createTime: _.gte(today)
          })
          .count(),
        ...submissionCollections.map(collection => 
          db.collection(collection).count()
        ),
        ...submissionCollections.map(collection => 
          db.collection(collection)
            .where({
              submitTime: _.gte(today)
            })
            .count()
        )
      ])

      // 定义活跃集合列表
      const activeCollections = [
        'Base', 'Internet', 'Software', 'Xinchuang', 'announcements',
        'battle_records', 'breakthrough_records', 'chat_messages', 'completedPapers',
        'dailyPoints', 'dailyRecords', 'dailyTasks', 'developers', 'hardware',
        'mockExams', 'qq_groups', 'questions', 'ser_breakthrough', 'settings',
        'sponsor', 'user_breakthrough', 'user_experience', 'user_favorite_questions',
        'user_wrong_questions', 'users', 'wanwei', 'wanwei_papers'
      ]

      let totalDocuments = 0
      let activeCollectionCount = 0
      let chatMessagesCount = 0

      // 并行处理集合统计
      await Promise.all(activeCollections.map(async (collectionName) => {
        try {
          const { total } = await db.collection(collectionName).count()
          totalDocuments += total
          if (total > 0) {
            activeCollectionCount++
          }
          if (collectionName === 'chat_messages') {
            chatMessagesCount = total
          }
        } catch (error) {
          console.warn(`获取集合 ${collectionName} 统计失败：`, error)
        }
      }))

      // 估算存储空间（每个文档平均 0.5KB）
      const totalStorage = Math.round(totalDocuments * 0.5)

      // 计算总提交数和今日提交数
      let totalSubmissions = 0
      let todaySubmissions = 0
      const submissionStats = {}

      submissionCollections.forEach((collection, index) => {
        const totalCount = submissionCounts[index].total || 0
        const todayCount = submissionCounts[index + submissionCollections.length].total || 0
        
        totalSubmissions += totalCount
        todaySubmissions += todayCount
        
        // 将集合名称转换为显示名称
        const displayName = collection
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        submissionStats[collection] = {
          total: totalCount,
          today: todayCount,
          displayName
        }
      })

      // 获取反馈统计
      const [feedbackCount, todayFeedbackCount] = await Promise.all([
        db.collection('feedback').count(),
        db.collection('feedback')
          .where({
            createTime: _.gte(today)
          })
          .count()
      ])

      this.setData({
        statistics: {
          totalUsers: userCount.total || 0,
          totalQuestions: totalSubmissions,
          todayNewUsers: todayUserCount.total || 0,
          todaySubmissions,
          totalCollections: activeCollections.length,
          totalDocuments,
          totalStorage: formatStorageSize(totalStorage),
          activeCollections: activeCollectionCount,
          chatMessages: chatMessagesCount,
          ...submissionStats,
          feedbackCount: feedbackCount.total || 0,
          todayFeedbackCount: todayFeedbackCount.total || 0
        }
      })
    } catch (error) {
      console.error('加载统计数据失败：', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }
  },

  // 清理聊天记录
  clearChatMessages() {
    wx.showModal({
      title: '确认清理',
      content: '确定要清理所有聊天记录吗？此操作不可恢复！',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '清理中...',
              mask: true
            })

            const { data: messages } = await db.collection('chat_messages').get()
            
            // 批量删除聊天记录
            for (const message of messages) {
              await db.collection('chat_messages').doc(message._id).remove()
            }

            wx.hideLoading()
            wx.showToast({
              title: '清理成功',
              icon: 'success'
            })

            // 重新加载统计数据
            this.loadStatistics()
          } catch (error) {
            console.error('清理聊天记录失败：', error)
            wx.hideLoading()
            wx.showToast({
              title: '清理失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  async onPullDownRefresh() {
    await this.loadStatistics()
    wx.stopPullDownRefresh()
  }
}) 