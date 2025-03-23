const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    darkMode: false,
    rewardName: '',
    rewardPoints: '',
    minQuestions: '',
    minCorrectRate: '',
    minRanking: '',
    isLoading: false,
    history: [],
    rewardList: [],
    loading: false
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.loadHistory();
    this.loadRewardList();
  },

  onNameInput(e) {
    this.setData({
      rewardName: e.detail.value
    });
  },

  // 监听积分输入
  onPointsInput(e) {
    let value = e.detail.value;
    // 确保输入的是正整数
    value = value.replace(/\D/g, '');
    if (value && parseInt(value) < 1) value = '1';
    
    this.setData({
      rewardPoints: value
    });
  },

  onMinQuestionsInput(e) {
    let value = e.detail.value;
    value = value.replace(/\D/g, '');
    this.setData({
      minQuestions: value
    });
  },

  onMinCorrectRateInput(e) {
    let value = e.detail.value;
    value = value.replace(/[^\d.]/g, '');
    if (value && parseFloat(value) > 100) value = '100';
    this.setData({
      minCorrectRate: value
    });
  },

  onMinRankingInput(e) {
    let value = e.detail.value;
    value = value.replace(/\D/g, '');
    this.setData({
      minRanking: value
    });
  },

  // 加载设置历史
  async loadHistory() {
    try {
      const { data } = await db.collection('reward_settings')
        .orderBy('createTime', 'desc')
        .limit(20)
        .get();

      // 格式化时间
      const history = data.map(item => ({
        ...item,
        time: this.formatTime(item.createTime)
      }));

      this.setData({ history });
    } catch (err) {
      console.error('加载设置历史失败：', err);
    }
  },

  // 设置奖励
  async setReward() {
    const points = parseInt(this.data.rewardPoints);
    if (!points || points < 1) {
      wx.showToast({
        title: '请输入有效的积分数量',
        icon: 'none'
      });
      return;
    }

    if (!this.data.rewardName.trim()) {
      wx.showToast({
        title: '请输入奖励名称',
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ isLoading: true });

      const rewardData = {
        name: this.data.rewardName,
        points: points,
        createTime: db.serverDate(),
        userCount: 0,
        status: 'active'
      };

      // 添加条件（如果有设置）
      if (this.data.minQuestions) {
        rewardData.minQuestions = parseInt(this.data.minQuestions);
      }
      if (this.data.minCorrectRate) {
        rewardData.minCorrectRate = parseFloat(this.data.minCorrectRate);
      }
      if (this.data.minRanking) {
        rewardData.minRanking = parseInt(this.data.minRanking);
      }

      // 创建新的奖励设置
      await db.collection('reward_settings').add({
        data: rewardData
      });

      wx.showToast({
        title: '设置成功',
        icon: 'success'
      });
      
      this.setData({ 
        rewardName: '',
        rewardPoints: '',
        minQuestions: '',
        minCorrectRate: '',
        minRanking: '',
        isLoading: false
      });
      this.loadHistory();
    } catch (err) {
      console.error('设置奖励失败：', err);
      wx.showToast({
        title: '设置失败',
        icon: 'error'
      });
      this.setData({ isLoading: false });
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    date = new Date(date);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  async loadRewardList() {
    this.setData({ loading: true })
    try {
      const { data } = await db.collection('reward_settings')
        .orderBy('createTime', 'desc')
        .get()
      
      this.setData({
        rewardList: data
      })
    } catch (error) {
      console.error('加载奖励列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async toggleRewardStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 'active' ? 'inactive' : 'active'
    
    wx.showLoading({ title: '处理中' })
    try {
      await db.collection('reward_settings').doc(id).update({
        data: { status: newStatus }
      })
      
      // 更新本地数据
      const rewardList = this.data.rewardList.map(item => {
        if (item._id === id) {
          return { ...item, status: newStatus }
        }
        return item
      })
      
      this.setData({ rewardList })
      wx.showToast({
        title: newStatus === 'active' ? '已启用' : '已停用',
        icon: 'success'
      })
    } catch (error) {
      console.error('更新奖励状态失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  deleteReward(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          try {
            await db.collection('reward_settings').doc(id).remove()
            
            // 更新本地数据
            const rewardList = this.data.rewardList.filter(item => item._id !== id)
            this.setData({ rewardList })
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
          } catch (error) {
            console.error('删除奖励失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  onPullDownRefresh() {
    this.loadRewardList().then(() => {
      wx.stopPullDownRefresh()
    })
  }
}); 