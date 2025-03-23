const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    darkMode: false,
    isLoading: true,
    activeTab: 'updateLogs',
    updateLogs: [],
    nextVersion: null,
    showModal: false,
    isEditing: false,
    currentId: '',
    formData: {
      version: '',
      date: '',
      categoryContent: [
        {
          title: '新功能',
          items: []
        },
        {
          title: '功能优化',
          items: []
        },
        {
          title: '问题修复',
          items: []
        }
      ]
    }
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.loadData();
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 加载数据
  async loadData() {
    this.setData({ isLoading: true });
    try {
      if (this.data.activeTab === 'updateLogs') {
        const res = await db.collection('update_logs')
          .orderBy('version', 'desc')
          .get();
        this.setData({ updateLogs: res.data });
      } else {
        const res = await db.collection('next_version')
          .limit(1)
          .get();
        this.setData({ nextVersion: res.data[0] || null });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 显示添加/编辑弹窗
  showAddModal() {
    if (this.data.activeTab === 'nextVersion' && this.data.nextVersion) {
      this.setData({
        showModal: true,
        isEditing: true,
        currentId: this.data.nextVersion._id,
        formData: {
          version: this.data.nextVersion.version,
          expectedDate: this.data.nextVersion.expectedDate,
          features: [...this.data.nextVersion.features]
        }
      });
    } else {
      this.setData({
        showModal: true,
        isEditing: false,
        currentId: '',
        formData: this.data.activeTab === 'updateLogs' ? {
          version: '',
          date: '',
          categoryContent: [
            { title: '新功能', items: [''] },
            { title: '功能优化', items: [''] },
            { title: '问题修复', items: [''] }
          ]
        } : {
          version: '',
          expectedDate: '',
          features: ['']
        }
      });
    }
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({ showModal: false });
  },

  // 阻止冒泡
  stopPropagation(e) {
    return false;
  },

  // 编辑日志
  editLog(e) {
    const id = e.currentTarget.dataset.id;
    const log = this.data.updateLogs.find(item => item._id === id);
    if (log) {
      this.setData({
        showModal: true,
        isEditing: true,
        currentId: id,
        formData: {
          version: log.version,
          date: log.date,
          categoryContent: log.categoryContent
        }
      });
    }
  },

  // 删除日志
  async deleteLog(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条日志吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('update_logs').doc(id).remove();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadData();
          } catch (error) {
            console.error('删除失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      ['formData.' + field]: value
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'formData.date': e.detail.value
    });
  },

  // 添加项目
  addItem(e) {
    const categoryIndex = e.currentTarget.dataset.categoryIndex;
    const items = this.data.formData.categoryContent[categoryIndex].items;
    items.push('');
    this.setData({
      ['formData.categoryContent[' + categoryIndex + '].items']: items
    });
  },

  // 删除项目
  deleteItem(e) {
    const { categoryIndex, itemIndex } = e.currentTarget.dataset;
    const items = this.data.formData.categoryContent[categoryIndex].items;
    items.splice(itemIndex, 1);
    this.setData({
      ['formData.categoryContent[' + categoryIndex + '].items']: items
    });
  },

  // 项目输入
  onItemInput(e) {
    const { categoryIndex, itemIndex } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({
      ['formData.categoryContent[' + categoryIndex + '].items[' + itemIndex + ']']: value
    });
  },

  // 添加功能
  addFeature() {
    const features = this.data.formData.features || [];
    features.push('');
    this.setData({
      'formData.features': features
    });
  },

  // 删除功能
  deleteFeature(e) {
    const index = e.currentTarget.dataset.index;
    const features = this.data.formData.features;
    features.splice(index, 1);
    this.setData({
      'formData.features': features
    });
  },

  // 功能输入
  onFeatureInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    this.setData({
      ['formData.features[' + index + ']']: value
    });
  },

  // 保存数据
  async saveData() {
    try {
      const data = this.data.formData;
      
      // 验证数据
      if (this.data.activeTab === 'updateLogs') {
        if (!data.version || !data.date) {
          throw new Error('请填写完整信息');
        }
        // 过滤空项目
        data.categoryContent = data.categoryContent.map(category => ({
          ...category,
          items: category.items.filter(item => item.trim())
        }));
      } else {
        if (!data.version || !data.expectedDate) {
          throw new Error('请填写完整信息');
        }
        // 过滤空功能
        data.features = (data.features || []).filter(item => item.trim());
      }

      if (this.data.isEditing) {
        // 更新数据
        if (this.data.activeTab === 'updateLogs') {
          await db.collection('update_logs').doc(this.data.currentId).update({
            data: {
              version: data.version,
              date: data.date,
              categoryContent: data.categoryContent
            }
          });
        } else {
          await db.collection('next_version').doc(this.data.currentId).update({
            data: {
              version: data.version,
              expectedDate: data.expectedDate,
              features: data.features
            }
          });
        }
      } else {
        // 添加数据
        if (this.data.activeTab === 'updateLogs') {
          await db.collection('update_logs').add({
            data: {
              version: data.version,
              date: data.date,
              categoryContent: data.categoryContent
            }
          });
        } else {
          // 先删除所有预告
          const oldVersions = await db.collection('next_version').get();
          for (const item of oldVersions.data) {
            await db.collection('next_version').doc(item._id).remove();
          }
          // 添加新预告
          await db.collection('next_version').add({
            data: {
              version: data.version,
              expectedDate: data.expectedDate,
              features: data.features
            }
          });
        }
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      this.hideModal();
      this.loadData();
      
      // 清除缓存，让首页重新加载
      wx.removeStorageSync('updateLogCache');
      wx.removeStorageSync('nextVersionCache');
      wx.removeStorageSync('updateDataCacheTime');
      
    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'error'
      });
    }
  },

  // 删除下一版本预告
  deleteNextVersion() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除下一版本预告吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('next_version').doc(this.data.nextVersion._id).remove();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.setData({
              nextVersion: null
            });
            this.loadData();
            
            // 清除缓存，让首页重新加载
            wx.removeStorageSync('nextVersionCache');
            wx.removeStorageSync('updateDataCacheTime');
          } catch (error) {
            console.error('删除失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  }
}); 