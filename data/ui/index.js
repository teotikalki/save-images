/* Copyright (C) 2014-2017 Joe Ertaba
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.

 * Home: http://add0n.com/save-images.html
 * GitHub: https://github.com/belaviyo/save-images/ */

'use strict';

var domain;
var port = chrome.runtime.connect({name: 'parser'});

var elements = {
  counter: {
    processed: document.getElementById('processed-number'),
    save: document.getElementById('save-number'),
    total: document.getElementById('total-number'),
    progress: document.getElementById('progress')
  },
  group: {
    size: document.getElementById('group-size'),
    dimension: document.getElementById('group-dimension'),
    type: document.getElementById('group-type'),
    regexp: document.getElementById('group-regexp'),
    blacklist: document.getElementById('group-blacklist'),
    origin: document.getElementById('group-origin'),
    identical: document.getElementById('group-identical')
  },
  save: {
    directory: document.getElementById('custom-directory'),
    format: document.getElementById('format'),
    filename: document.getElementById('filename'),
    dialog: document.getElementById('open-save-dialog')
  },
  size: {
    min: document.getElementById('size-min'),
    max: document.getElementById('size-max'),
    ignore: document.getElementById('unknown-size-skip')
  },
  dimension: {
    width: {
      min: document.getElementById('dimension-width-min'),
      max: document.getElementById('dimension-width-max')
    },
    height: {
      min: document.getElementById('dimension-height-min'),
      max: document.getElementById('dimension-height-max')
    },
    ignore: document.getElementById('unknown-dimension-skip')
  },
  type: {
    jpeg: document.getElementById('type-jpeg'),
    bmp: document.getElementById('type-bmp'),
    gif: document.getElementById('type-gif'),
    png: document.getElementById('type-png'),
    webp: document.getElementById('type-webp'),
    all: document.getElementById('type-all'),
    noType: document.getElementById('no-type')
  },
  regexp: {
    input: document.getElementById('regexp-input')
  },
  blacklist: {
    input: document.getElementById('blacklist-input')
  },
  deep: {
    level: document.getElementById('deep-level'),
    stat: document.getElementById('deep-stat'),
    progress: document.getElementById('deep-progress')
  }
};

var images = {};
var processed = 0;

function validate(name) {
  name = name.replace(/\.zip/g, '');
  return name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-') + '.zip';
}

function build() {
  const custom = elements.save.directory.value.replace(/[\\\\/:*?"<>|]/g, '_');
  let filename = elements.save.filename.value;
  filename = validate(filename);
  filename = custom ? custom + '/' + filename : filename;

  return {
    filename,
    addJPG: elements.type.noType.checked,
    images: filtered(),
    saveAs: elements.save.dialog.checked
  };
}

function filtered() {
  const objs = Object.values(images);
  const keys = objs.map(o => o.key);

  return objs // size
  .filter(img => {
    if (elements.group.size.checked) {
      if (img.size) {
        if (Number(elements.size.min.value) && Number(elements.size.min.value) > img.size) {
          return false;
        }
        if (Number(elements.size.max.value) && Number(elements.size.max.value) < img.size) {
          return false;
        }
        return true;
      }
      else {
        return !elements.size.ignore.checked;
      }
    }
    else {
      return true;
    }
  })
  // dimension
  .filter(img => {
    if (elements.group.dimension.checked) {
      if (img.width) {
        if (Number(elements.dimension.width.min.value) && Number(elements.dimension.width.min.value) > img.width) {
          return false;
        }
        if (Number(elements.dimension.width.max.value) && Number(elements.dimension.width.max.value) < img.width) {
          return false;
        }
      }
      if (img.height) {
        if (Number(elements.dimension.height.min.value) && Number(elements.dimension.height.min.value) > img.height) {
          return false;
        }
        if (Number(elements.dimension.height.max.value) && Number(elements.dimension.height.max.value) < img.height) {
          return false;
        }
      }
      if (img.width && img.height) {
        return true;
      }
      else {
        return !elements.dimension.ignore.checked;
      }
    }
    else {
      return true;
    }
  })
  .filter(img => {
    if (elements.type.all.checked || !elements.group.type.checked) {
      return true;
    }
    else {
      if (img.type) {
        if (img.type === 'image/jpeg' && elements.type.jpeg.checked) {
          return true;
        }
        if (img.type === 'image/png' && elements.type.png.checked) {
          return true;
        }
        if (img.type === 'image/bmp' && elements.type.bmp.checked) {
          return true;
        }
        if (img.type === 'image/webp' && elements.type.webp.checked) {
          return true;
        }
        if (img.type === 'image/gif' && elements.type.gif.checked) {
          return true;
        }

        return false;
      }
      else {
        return false;
      }
    }
  })
  // regexp
  .filter(img => {
    if (elements.group.regexp.checked) {
      const r = new RegExp(elements.regexp.input.value);
      return r.test(img.src);
    }
    else {
      return true;
    }
  })
  // blacklist
  .filter(img => {
    if (elements.group.blacklist.checked) {
      const list = elements.blacklist.input.value.split(/\s*,\s*/)
        .map(k => k.toLowerCase())
        .filter(a => a);
      return !list.some(keyword => img.src.toLowerCase().indexOf(keyword) !== -1);
    }
    else {
      return true;
    }
  })
  // origin
  .filter(img => {
    if (elements.group.origin.checked) {
      const hostname = img.hostname;
      return domain.endsWith(hostname) || hostname.endsWith(domain) || hostname === 'local';
    }
    else {
      return true;
    }
  })
  // identical
  .filter((img, index) => {
    if (elements.group.identical.checked) {
      return img.size ? keys.indexOf(img.key) === index : true;
    }
    else {
      return true;
    }
  });
}

function update() {
  const index = elements.counter.save.textContent = filtered().length;
  document.querySelector('[data-cmd=save]').disabled = index === 0;
  document.querySelector('[data-cmd=copy]').disabled = index === 0;
  document.querySelector('[data-cmd=gallery]').disabled = index === 0;
}

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'progress') {
    elements.counter.progress.dataset.visible = true;
    elements.counter.progress.value = elements.counter.progress.max - request.value;
  }
  else if (request.cmd === 'build') {
    response(build());
  }
  else if (request.cmd === 'found-images') {
    if (sender.tab) {
      // prevent duplication
      return;
    }
    request.images.forEach(img => {
      if (!images[img.src]) {
        img.hostname = (new URL(img.src)).hostname || 'local';
        img.key = img.size + '-' + img.hostname;
        images[img.src] = img;
        if (!img.type) {
          chrome.runtime.sendMessage({
            cmd: 'image-data',
            src: img.src
          }, response => {
            images[img.src] = Object.assign(images[img.src], response);
            img.key = img.size + '-' + img.hostname;
            processed += 1;

            if (response.type.startsWith('image/') === false) {
              delete images[img.src];
              elements.counter.total.textContent = Object.keys(images).length;
              processed -= 1;
            }

            elements.counter.processed.textContent = processed;
            update();
          });
        }
        else {
          processed += 1;
          elements.counter.processed.textContent = processed;
          update();
        }
      }
    });
    elements.counter.total.textContent = Object.keys(images).length;
    update();
  }
  else if (request.cmd === 'found-links') {
    port.postMessage(request);
  }
  else if (request.cmd === 'get-images') {
    response(build());
  }
});

var search = () => chrome.runtime.sendMessage({
  cmd: 'get-images',
  deep: Number(elements.deep.level.value)
}, result => {
  domain = result.domain || '';
  elements.save.directory.value = domain;
  // filename
  const time = new Date();
  elements.save.filename.value = (elements.save.format.value || elements.save.format.placeholder)
    .replace('[title]', result.title)
    .replace('[date]', time.toLocaleDateString())
    .replace('[time]', time.toLocaleTimeString());
});
document.addEventListener('DOMContentLoaded', search);

elements.deep.level.addEventListener('change', search);

// commands
document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;
  if (cmd === 'save') {
    target.disabled = true;
    const obj = Object.assign(build(), {
      cmd: 'save-images'
    });
    const save = () => {
      elements.counter.progress.value = 0;
      elements.counter.progress.max = obj.images.length;
      chrome.runtime.sendMessage(obj);
    };

    if (images.length > 30) {
      if (window.confirm(`Are you sure you want to download "${images.length}" images?`)) {
        save();
      }
    }
    else {
      save();
    }
  }
  else if (cmd === 'copy') {
    const cb = document.getElementById('clipboard');
    cb.style.display = 'block';
    cb.value = Object.keys(images).join('\n');
    cb.focus();
    cb.select();
    const bol = document.execCommand('copy');
    cb.style.display = 'none';

    chrome.runtime.sendMessage({
      method: 'notify',
      message: bol ? 'Image links are copied to the clipboard' : 'Cannot copy to the clipboard'
    });
  }
  else if (cmd === 'close') {
    chrome.runtime.sendMessage({
      cmd: 'close-me'
    });
  }
  else if (cmd === 'restart') {
    window.location.reload();
  }
  else if (cmd === 'gallery') {
    window.parent.to.gallery();
  }
  else if (cmd === 'stop') {
    port.postMessage({
      cmd: 'stop'
    });
  }
});
// update counter
document.addEventListener('change', update);
{ // wait for .5 seconds before updating
  let id;
  const input = () => {
    window.clearTimeout(id);
    window.setTimeout(update, 500);
  };
  document.addEventListener('input', input);
}

// port
let count = 0;
port.onMessage.addListener(request => {
  if (request.cmd === 'count') {
    count = Math.max(request.count, count);
    elements.deep.stat.textContent = request.count;
    elements.deep.progress.value = request.count;
    elements.deep.progress.max = count;
    elements.deep.progress.dataset.visible = request.count !== 0;
  }
});

// image types
{
  const root = document.getElementById('image-types');
  root.addEventListener('change', () => {
    document.getElementById(
      root.querySelector(':checked') ? 'type-selection' : 'type-all'
    ).checked = true;
  });
}
