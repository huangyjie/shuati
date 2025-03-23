Page({
  data: {
    groups: [],
    loading: true
  },

  onLoad() {
    this.loadQQGroups();
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 加载QQ群信息
  async loadQQGroups() {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('qq_groups')
        .orderBy('order', 'asc')  // 按order字段升序排列
        .get();

      console.log('获取到的QQ群数据:', data);

      this.setData({
        groups: data,
        loading: false
      });
    } catch (err) {
      console.error('获取QQ群信息失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        loading: false
      });
    }
  },

  // 复制群号
  copyGroupNumber(e) {
    const number = e.currentTarget.dataset.number;
    console.log('复制群号:', number);
    wx.setClipboardData({
      data: number,
      success: () => {
        wx.showToast({
          title: '群号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 预览二维码
  previewQRCode(e) {
    const url = e.currentTarget.dataset.url;
    console.log('预览二维码URL:', url);
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  // 保存二维码到相册
  saveQRCode(e) {
    const url = e.currentTarget.dataset.url;
    console.log('保存二维码:', url);
    wx.showActionSheet({
      itemList: ['保存图片到相册'],
      success: () => {
        wx.showLoading({
          title: '保存中...'
        });
        wx.downloadFile({
          url: url,
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                  });
                },
                fail: (err) => {
                  console.error('保存图片失败:', err);
                  wx.showToast({
                    title: '保存失败',
                    icon: 'none'
                  });
                }
              });
            }
          },
          fail: (err) => {
            console.error('下载图片失败:', err);
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
          },
          complete: () => {
            wx.hideLoading();
          }
        });
      }
    });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadQQGroups();
    wx.stopPullDownRefresh();
  }
}); 