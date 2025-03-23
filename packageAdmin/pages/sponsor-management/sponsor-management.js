const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    darkMode: false,
    sponsors: [],
    showModal: false,
    isEdit: false,
    currentSponsor: {
      _id: '',
      name: '',
      count: '',
      remark: ''
    }
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.loadSponsors();
  },

  // 加载赞助者列表
  async loadSponsors() {
    try {
      wx.showLoading({ title: '加载中...' });
      const { data } = await db.collection('sponsor')
        .orderBy('_createTime', 'desc')
        .get();
      
      // 格式化时间
      const sponsors = data.map(item => ({
        ...item,
        _createTime: this.formatTime(item._createTime)
      }));
      
      this.setData({ sponsors });
      wx.hideLoading();
    } catch (err) {
      console.error('加载赞助者列表失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      currentSponsor: {
        _id: '',
        name: '',
        count: '',
        remark: ''
      }
    });
  },

  // 显示编辑弹窗
  showEditModal(e) {
    const { id, name, count, remark } = e.currentTarget.dataset;
    this.setData({
      showModal: true,
      isEdit: true,
      currentSponsor: {
        _id: id,
        name: name || '',
        count: count || '',
        remark: remark || ''
      }
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false
    });
  },

  // 阻止冒泡
  preventBubble() {},

  // 监听昵称输入
  onNameInput(e) {
    this.setData({
      'currentSponsor.name': e.detail.value
    });
  },

  // 监听次数输入
  onCountInput(e) {
    let value = e.detail.value;
    // 确保输入的是正整数
    value = value.replace(/\D/g, '');
    if (value && parseInt(value) < 1) value = '1';
    
    this.setData({
      'currentSponsor.count': value
    });
  },

  // 监听备注输入
  onRemarkInput(e) {
    this.setData({
      'currentSponsor.remark': e.detail.value
    });
  },

  // 确认添加/编辑赞助者
  async confirmSponsor() {
    const { currentSponsor, isEdit } = this.data;
    
    if (!currentSponsor.name.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    // 确保次数是有效的正整数
    const count = parseInt(currentSponsor.count) || 1;

    try {
      wx.showLoading({ title: '保存中...' });
      
      const data = {
        name: currentSponsor.name.trim(),
        count: count,
        remark: currentSponsor.remark.trim()
      };

      if (isEdit) {
        // 编辑现有赞助者
        await db.collection('sponsor').doc(currentSponsor._id).update({
          data: data
        });
      } else {
        // 添加新赞助者
        data._createTime = db.serverDate();
        await db.collection('sponsor').add({
          data: data
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: isEdit ? '更新成功' : '添加成功',
        icon: 'success'
      });

      this.hideModal();
      this.loadSponsors();
    } catch (err) {
      console.error('保存赞助者失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  // 删除赞助者
  async deleteSponsor(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      const res = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这条赞助记录吗？',
        confirmColor: '#ff4d4f'
      });

      if (res.confirm) {
        wx.showLoading({ title: '删除中...' });
        await db.collection('sponsor').doc(id).remove();
        wx.hideLoading();
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        this.loadSponsors();
      }
    } catch (err) {
      console.error('删除赞助者失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
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
  }
}); 