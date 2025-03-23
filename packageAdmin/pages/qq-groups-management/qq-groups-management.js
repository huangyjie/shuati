const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    groups: [],
    showModal: false,
    editingGroup: null,
    formData: {
      name: '',
      number: '',
      description: '',
      qrcode: '',
      order: ''
    },
    darkMode: false,
    qrcodeType: 'url' // 默认使用图片链接方式
  },

  onLoad() {
    // 从本地存储获取夜间模式状态
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({ darkMode });
    this.loadGroups();
  },

  // 处理输入
  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 切换二维码输入类型
  switchQrcodeType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      qrcodeType: type,
      'formData.qrcode': '' // 切换类型时清空已输入的值
    });
  },

  // 验证图片链接
  async validateImageUrl(url) {
    try {
      await new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: url,
          success: resolve,
          fail: reject
        });
      });
      return true;
    } catch (err) {
      console.error('图片链接验证失败:', err);
      wx.showToast({
        title: '图片链接无效',
        icon: 'error'
      });
      return false;
    }
  },

  // 加载QQ群列表
  async loadGroups() {
    try {
      const { data } = await db.collection('qq_groups')
        .orderBy('order', 'asc')
        .get();
      this.setData({ groups: data });
    } catch (err) {
      console.error('加载QQ群列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  // 显示添加群弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      editingGroup: null,
      formData: {
        name: '',
        number: '',
        description: '',
        qrcode: '',
        order: ''
      },
      qrcodeType: 'url'
    });
  },

  // 显示编辑群弹窗
  showEditModal(e) {
    const group = e.currentTarget.dataset.group;
    this.setData({
      showModal: true,
      editingGroup: group,
      formData: { ...group },
      qrcodeType: group.qrcode && group.qrcode.startsWith('cloud://') ? 'upload' : 'url'
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
      editingGroup: null
    });
  },

  // 选择二维码图片
  async chooseQRCode() {
    try {
      const { tempFilePaths } = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (tempFilePaths && tempFilePaths[0]) {
        wx.showLoading({ title: '上传中...' });
        const cloudPath = `qq_groups/${Date.now()}_${Math.random().toString(36).slice(-6)}.jpg`;
        const { fileID } = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePaths[0]
        });

        this.setData({
          'formData.qrcode': fileID
        });
        wx.hideLoading();
      }
    } catch (err) {
      console.error('上传二维码失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '上传失败',
        icon: 'error'
      });
    }
  },

  // 预览二维码
  previewQRCode(e) {
    const url = e.currentTarget.dataset.url || this.data.formData.qrcode;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  // 提交表单
  async submitForm() {
    const { formData, editingGroup, qrcodeType } = this.data;
    
    console.log('提交的表单数据:', formData); // 添加日志输出
    
    // 表单验证
    if (!formData.name.trim() || !formData.number.trim()) {
      wx.showToast({
        title: '请填写群名称和群号',
        icon: 'none'
      });
      return;
    }

    // 验证图片链接（如果是URL类型）
    if (qrcodeType === 'url' && formData.qrcode) {
      const isValid = await this.validateImageUrl(formData.qrcode);
      if (!isValid) return;
    }

    try {
      wx.showLoading({ title: '保存中...' });
      
      // 准备要保存的数据
      const saveData = {
        name: formData.name.trim(),
        number: formData.number.trim(),
        description: (formData.description || '').trim(),
        qrcode: formData.qrcode || '',
        order: parseInt(formData.order) || 0
      };
      
      if (editingGroup) {
        // 如果是编辑模式且更换了图片类型，需要删除原有的云存储图片
        if (editingGroup.qrcode && editingGroup.qrcode.startsWith('cloud://') && 
            (qrcodeType === 'url' || formData.qrcode !== editingGroup.qrcode)) {
          await wx.cloud.deleteFile({
            fileList: [editingGroup.qrcode]
          });
        }

        // 更新群信息
        await db.collection('qq_groups').doc(editingGroup._id).update({
          data: saveData
        });
      } else {
        // 添加新群
        await db.collection('qq_groups').add({
          data: saveData
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: editingGroup ? '更新成功' : '添加成功',
        icon: 'success'
      });

      this.hideModal();
      this.loadGroups();
    } catch (err) {
      console.error('保存QQ群信息失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },

  // 删除群
  async deleteGroup(e) {
    const id = e.currentTarget.dataset.id;
    
    try {
      const res = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个QQ群吗？',
        confirmColor: '#ff4d4f'
      });

      if (res.confirm) {
        wx.showLoading({ title: '删除中...' });
        
        // 获取群信息以删除二维码
        const { data: group } = await db.collection('qq_groups').doc(id).get();
        
        // 如果有云存储的二维码，删除它
        if (group.qrcode && group.qrcode.startsWith('cloud://')) {
          await wx.cloud.deleteFile({
            fileList: [group.qrcode]
          });
        }

        // 删除群记录
        await db.collection('qq_groups').doc(id).remove();
        
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        this.loadGroups();
      }
    } catch (err) {
      console.error('删除QQ群失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadGroups();
    wx.stopPullDownRefresh();
  }
}); 