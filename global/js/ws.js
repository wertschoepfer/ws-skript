/* eslint-disable indent */
/*global $JR, $JRApp, $JRUSER, LoadingLayer, retrieveFromSTVHeaderElement, Chart, WS_LIB_VERSION*/
// eslint-disable-next-line no-redeclare
var WS = {

	/**
	 *  Helper - Functions
	 *  some might be unnecessary when migration to ES6 and newer  
	 */

	 /**
	  *  for each function
	  * @param {Object} providedObject The Object/Array to be looped over
	  * @param {function (index, value)} callThisFunction function which will be called on every element of Object
	  */
	each: function (providedObject, callThisFunction) {
		var continueLoop = true;
		for (var key in providedObject) {
			// eslint-disable-next-line no-prototype-builtins
			if (providedObject.hasOwnProperty(key)) {
				continueLoop = callThisFunction.apply(providedObject[key], [key, providedObject[key]]);
				if (continueLoop === false) {
					return;
				}
			}
		}
	},

	/**
	 * 
	 * @param {Object} object 
	 */
	keys: function (object) {
		var keys = [];

		if (!WS.isObj(object) && !WS.isArray(object)) {
			return keys;
		}

		WS.each(object, function (key) {
			keys.push(key);
		});

		return keys;
	},

	isObj: function (variable) {
		return variable !== null && typeof variable === 'object';
	},

	isNode: function (obj) {
		return obj instanceof Element || obj instanceof HTMLDocument;
	},

	isArray: function (arr) {
		return arr instanceof Array;
	},

	isEmpty: function (obj) {
		if (obj == null) {
			return true;
		}

		if (Array.isArray(obj)) {
			return obj.length === 0;
		}

		if (typeof obj !== 'object') {
			return false;
		}

		var key;
		for (key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				return false;
			}
		}

		return true;
	},

	contains: function (value, validValues) {
		var found = false;
		this.each(validValues, function (i, currentVal) {
			if (value === currentVal) {
				found = true;
			}
		});
		return found;
	},

	create: function (tag, attributes, css) {
		var element = {};

		var createTag = function () {
			if (!tag || typeof tag !== 'string' || tag == '') {
				return false;
			}

			element = document.createElement(tag);

			return true;
		};

		var createAttributes = function () {
			WS.each(attributes, function (attrName, value) {
				if (attrName === 'style') {
					var style = '';
					WS.each(value, function (key, val) {
						style += key + ': ' + val + ';';
					});
					value = style;
				}

				if (attrName === 'html' || attrName === 'innerHTML') {
					element.innerHTML = value;
					return;
				}

				element.setAttribute(attrName, value);
			});

			if (css && typeof css === 'string') {
				element.setAttribute('style', css);
			}

			return true;
		};

		if (!createTag()) {
			return false;
		}

		if (!createAttributes()) {
			return false;
		}

		return element;
	},

	get: function (selector, forceSingleObject) {
		if (!selector || typeof selector !== 'string') {
			return false;
		}

		var element = {};
		var identifier = selector.substr(0, 1);

		if (identifier === '#' && selector.indexOf(' ') === -1) {
			element = document.getElementById(selector.substr(1));
		} else {
			element = [].slice.call(document.querySelectorAll(selector));

			if (forceSingleObject) {
				element = element[0];
			}
		}

		return element;
	},

	/**
	 * 
	 * 
	 */

	/**
	 * parsing dome to get model object containing all Dialogelements as Objects  
	 * @param {Object {renderers, listeners, dependencies}} appConfig 
	 * @returns {Object} model containing all Dialogelements 
	 */
	createDataModel: function (appConfig) {
		return WS.dataModel.create(appConfig);
	},

	executeDialogfunction: function (className, parameters, callback) {
		jQuery.ajax({
			type: 'POST',
			url: window.location.origin + window.location.pathname + '?cmd=Ajax_ExecutePHPFunction',
			data: {
				functionId: className,
				workflowid: document.getElementById('workflowid').value,
				jr_simulation: document.getElementById('jr_simulation').value,
				dialogValues: {
					processname: document.getElementById('processname').value,
					workflowid: document.getElementById('workflowid').value,
					version: document.getElementById('version').value,
					step: document.getElementById('step').value,
					jr_simulation: document.getElementById('jr_simulation').value,
					jr_new_step: document.getElementById('jr_new_step').value
				},
				userParameters: parameters,
				ps: '',
				username: '',
				do: ''
			},
			success: function (response) {
				if (response.result && response.result.__DialogFunctionClassSaveCalled__) {
					WS.get("#jr_new_step").value = 0;
				}
				if (callback && typeof callback === 'function') {
					callback.apply(undefined, [response]);
				}
			},
			dataType: 'json'
		});
	},

	sqlRefresh: function (leaf, callback, retries) {
		if (!retries) {
			retries = 0;
		}

		var jrType = '';

		if (leaf._type === 'sqlTextboxLeaf') {
			jrType = 'SqlTextbox';
		} else if (leaf._type === 'sqlTableLeaf') {
			jrType = 'SqlTable';
		} else {
			jrType = 'SqlList';
		}

		var elementName = leaf.name;

		if (leaf._type === 'sqlAutocompleteLeaf') {
			var source = '';
			if (leaf.isSubtableElement) {
				source = $(retrieveFromSTVHeaderElement(leaf.name)).retrieve('source');
				elementName = leaf.name.replace(leaf._subtableName + '_', '').replace('_' + leaf._rowId,'');
			} else {
				source = $(leaf.name).retrieve('source');
			}

			var url = source + '&' +
				jQuery.param({
					autocomplete_mode: leaf._autoCompleteMode,
					autocomplete_display: leaf._oldDisplayValue,
					autocomplete_value: leaf._oldValue,
					element_name : elementName,
					jrsubtablerow : leaf._rowId
				});

			jQuery.ajax({
				type: 'POST',
				url: url,
				data: $('dialogForm').serialize(true),
				success: function (response) {
					if (callback && typeof callback === 'function') {
						callback.apply(undefined, [response]);
					}
				},
				dataType: 'json'
			});

			return;
		}

		jQuery.ajax({
			type: 'POST',
			url: window.location.origin + window.location.pathname,
			data: jQuery.extend(
				{
					cmd: 'Ajax_SqlRefresh',
					elementName: leaf.name,
					elementType: jrType
				},
				$('dialogForm').serialize(true)
			),
			success: function (response) {
				if (response.status === 'error' && retries < 5) {
					WS.sqlRefresh(leaf, callback, ++retries);
				} else if (callback && typeof callback === 'function') {
					callback.apply(undefined, [response]);
				}
			},
			dataType: 'json'
		});
	},

	subtableRefresh: function (leaf, callback, model, retries) {
		if (!retries) {
			retries = 0;
		}

		var addDisabledElements = function (model) {
			if (model){
				var disabledElements = {};
				WS.each(model.getElements(), function(index){
					if(this._type === "subtableNode"){
						var nameSubtable = index;
						WS.each(model.getElements()[index].rows(), function(index){
							var rowId = index;
							WS.each(this, function(index){
								if(this.disabled){
									disabledElements[nameSubtable + '_' + this.name + '_' + rowId] = this.value;
								}
							});
						});
					}

					if(this.disabled){
						if (this._type === "dateLeaf"){
							var date = "";
							if(this.value.getDay().length === 2){
								date += this.value.getDay() + ".";
							} else {
								date += "0" + this.value.getDay() + ".";
							}
							if(this.value.getMonth().length === 2){
								date += this.value.getMonth() + ".";
							} else {
								date += "0" + this.value.getMonth() + ".";
							}
							date += this.value.getFullYear();
							disabledElements[this.name] = date;
						} else {
							disabledElements[this.name] = this.value;
						}
					}
				});
				return disabledElements;
			}
		}

		jQuery.ajax({
			type: 'POST',
			url: window.location.origin + window.location.pathname,
			data: jQuery.extend($('dialogForm').serialize(true), {
				cmd: 'Ajax_Subtable',
				action: 'refresh',
				subtableView: leaf._subtable._viewName,
				view: leaf._subtable._viewName,
				row: '[' + leaf._rowId.toString() + ']',
				// eslint-disable-next-line quotes
				rowId: '["' + leaf._rowId + '"]',
				// eslint-disable-next-line quotes
				column: '["' + leaf._columnName.toString() + '"]'
			},
				addDisabledElements(model)
			),
			success: function (response) {
				if (response.status === 'error' && retries < 3) {
					WS.subtableRefresh(leaf, callback, ++retries);
				} else if (callback && typeof callback === 'function') {
					callback.apply(undefined, [response]);
				}
			},
			dataType: 'json'
		});
	},

	ajax: function (config) {
		if (!config) {
			return false;
		}

		var ajax = new XMLHttpRequest();

		ajax.onreadystatechange = function () {
			if (ajax.readyState === XMLHttpRequest.DONE) {
				var response = ajax.responseText;

				if (!config.contentType || config.contentType === 'json') {
					try {
						response = JSON.parse(ajax.responseText);
					} catch (e) {
						/*keep it as text*/
					}
				}

				if (ajax.status === 200) {
					if (config.success && typeof config.success === 'function') {
						config.success.apply(ajax, [response, ajax.status]);
					}
				} else {
					if (config.error && typeof config.error === 'function') {
						config.error.apply(ajax, [response, ajax.status]);
					}
				}

				if (config.always && typeof config.always === 'function') {
					config.always.apply(ajax, [response, ajax.status]);
				}
			}
		};

		var requestPayload = '';

		WS.each(config.params, function (key, value) {
			requestPayload += key + '=' + encodeURIComponent(value) + '&';
		});

		requestPayload = encodeURI(requestPayload.slice(0, -1));

		ajax.open(config.method || 'GET', config.url || WS.getDefaultAjaxUrl(), true);
		ajax.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		ajax.send(requestPayload);
	},

	getDefaultAjaxUrl : function() {
		return window.location.origin + '/data/ws_utils/' + WS.conf.version() + '/ajax.php';
	},

	form: {
		createPopup: function (config) {
			config = config || {};

			var popup = jQuery('<div />');

			popup.dialog({
				title: config.title || '',
				width: config.width || 500,
				height: config.height || 400,
				modal: config.modal || true,
				buttons: config.buttons || [
					{
						text: 'OK',
						click: function () {
							jQuery(this).dialog('destroy');
						}
					}
				]
			});

			if (config.content) {
				popup.html(config.content);
			}

			return popup;
		},

		createDataTable: function (dtConf, callback) {
			if (!dtConf || !dtConf.container) {
				return;
			}

			var container;

			if (WS.isNode(dtConf.container)) {
				container = dtConf.container;
			} else {
				container = WS.get(dtConf.container, true);
			}

			if (!container) {
				return;
			}

			var loadingSpinner = WS.create('div', {
				class: 'jr-spinner'
			});

			container.innerHTML = loadingSpinner.outerHTML;

			var table = WS.create('table', {
				id: dtConf.id != undefined ? dtConf.id : 'dataTable_' + new Date().getMilliseconds(),
				class: dtConf.class != undefined ? dtConf.class : ''
			});

			if (dtConf.footer) {
				table.innerHTML = '<tbody></tbody><tfoot></tfoot>';
			}

			var insertTable = function (createResponse) {
				container.innerHTML = '';
				container.appendChild(table);
				var datatable = jQuery(table).DataTable(dtConf);

				if (callback && typeof callback === 'function') {
					callback.apply(table, [datatable, createResponse, dtConf]);
				}
			};

			if (dtConf.dataSource) {
				WS.executeDialogfunction(
					dtConf.dataSource,
					dtConf.queryParameters ? dtConf.queryParameters : {},
					function (response) {
						if (response && response.status === 'ok') {
							var rows = response.result.rows;
							dtConf.data = rows;
							insertTable(response);
						}
					}
				);

				if (dtConf.silent) {
					new LoadingLayer().hide();
				}
			} else {
				insertTable();
			}
		},

		createChart: function (config) {
			if (typeof Chart !== 'function') {
				console.log('Chart JS is undefined, aborting chart creation');
				return;
			}

			if (config === undefined) {
				console.log('no config provided, aborting chart creation');
				return;
			}

			if (config.container === undefined) {
				console.log('no container provided, aborting chart creation');
				return;
			}

			var labels = [],
				data = [];

			WS.each(config.data, function (key, value) {
				labels.push(key);
				data.push(value);
			});

			var container;

			if (WS.isNode(config.container)) {
				container = config.container;
			} else {
				container = WS.get('#' + config.container);
			}

			var canvas = WS.create('canvas');

			if (config.width) {
				canvas.style.width = config.width;
			}

			if (config.height) {
				canvas.style.height = config.height;
			}

			container.appendChild(canvas);

			var options = config.options || {};

			options.responsive = true;

			var colors = [
				'rgb(255, 99, 132)',
				'rgb(255, 159, 64)',
				'rgb(255, 205, 86)',
				'rgb(75, 192, 192)',
				'rgb(54, 162, 235)',
				'rgb(153, 102, 255)',
				'rgb(201, 203, 207)'
			];
			var getBackgroundColor = function (context) {
				return context.dataIndex > colors.length - 1
					? colors[(colors.length - 1) / context.dataIndex]
					: colors[context.dataIndex];
			};

			var pieChart = new Chart(canvas.getContext('2d'), {
				type: config.type,
				data: {
					datasets: [
						{
							data: data,
							backgroundColor: getBackgroundColor
						}
					],
					labels: labels
				},
				options: options
			});

			return pieChart;
		},

		createPieChart: function (config) {
			if (typeof Chart !== 'function') {
				console.log('Chart JS is undefined, aborting chart creation');
				return;
			}

			if (config === undefined) {
				console.log('no config provided, aborting chart creation');
				return;
			}

			if (config.container === undefined) {
				console.log('no container provided, aborting chart creation');
				return;
			}

			var labels = [],
				data = [];

			WS.each(config.data, function (key, value) {
				labels.push(key);
				data.push(value);
			});

			var container;

			if (WS.isNode(config.container)) {
				container = config.container;
			} else {
				container = WS.get('#' + config.container);
			}

			var canvas = WS.create('canvas');

			if (config.width) {
				canvas.style.width = config.width;
			}

			if (config.height) {
				canvas.style.height = config.height;
			}

			container.appendChild(canvas);

			var options = config.options || {};

			options.responsive = true;

			var colors = [
				'rgb(255, 99, 132)',
				'rgb(255, 159, 64)',
				'rgb(255, 205, 86)',
				'rgb(75, 192, 192)',
				'rgb(54, 162, 235)',
				'rgb(153, 102, 255)',
				'rgb(201, 203, 207)'
			];
			var getBackgroundColor = function (context) {
				return context.dataIndex > colors.length - 1
					? colors[(colors.length - 1) / context.dataIndex]
					: colors[context.dataIndex];
			};

			var pieChart = new Chart(canvas.getContext('2d'), {
				type: config.cutOut > 0 ? 'doughnut' : 'pie',
				data: {
					datasets: [
						{
							data: data,
							backgroundColor: getBackgroundColor
						}
					],
					labels: labels
				},
				options: options
			});

			return pieChart;
		},

		enrichTextarea: function (leaf, mceConf) {
			if (!tinymce) {
				console.log('tinymce is not initialized.');
				return;
			}

			if (!mceConf) {
				mceConf = {};
			}

			WS.get('#' + leaf.node.id + '_label2').style.display = 'none';
			var height = mceConf.height || leaf.node.offsetHeight || 50;
			var width = mceConf.width || leaf.node.offsetWidth || 100;
			var editorId = 'tinymce_' + leaf.node.id;
			var editorContent = leaf.value;
			var container = WS.create('div', { id: editorId, class: 'tinymce-inline-container' });
			container.style.height = '100%';
			var parentNode = leaf.node.parentNode;
			parentNode.appendChild(container);
			parentNode.style.height = height + 'px';
			parentNode.style.width = width + 'px';
			leaf.editorContainer = container;
			leaf.node.style.display = 'none';

			Object.defineProperty(leaf, 'readonly', {
				enumerable: true,
				configurable: true,
				set: function (newValue) {
					if (newValue == 1 || newValue === 'Y') {
						container.contentEditable = false;
						leaf.editor.readonly = true;
					} else {
						container.contentEditable = true;
						leaf.editor.readonly = false;
					}
					leaf.render(leaf, 'readonly');
				},
				get: function () {
					return container.contentEditable == false;
				}
			});

			Object.defineProperty(leaf, 'value', {
				enumerable: true,
				configurable: true,
				set: function (newValue) {
					if (newValue != leaf.node.value) {
						leaf.node.value = newValue;
						leaf.editor.setContent(newValue);
						leaf.render(leaf, 'value');
					}
				},
				get: function () {
					return leaf.node.value;
				}
			});

			var editorConfig = WS.conf.defaultEditorInlineConfig('#' + editorId, editorContent);

			WS.each(mceConf, function (configName, configValue) {
				if (configName === 'width' || configName === 'height') {
					return;
				}
				editorConfig[configName] = configValue;
			});

			editorConfig.setup = function(editor) {
				editor.on('init', function(e) {
					editor.setContent(leaf.value);
					if(editorConfig.readonly) {
						container.contentEditable = true;
					}
				});
				editor.on('Change', function() {
					leaf.node.value = editor.getContent();
				});
			};

			tinymce.init(editorConfig);
			leaf.editor = tinymce.get(editorId);
		},
	},

	conf: {
		version: function() {
			return typeof WS_LIB_VERSION !== "undefined" && Number.isInteger(WS_LIB_VERSION) ? WS_LIB_VERSION : 4;
		},

		defaultEditorInlineConfig: function (selector, editorContent) {
			return {
				selector: selector,
				menubar: false,
				inline: true,
				plugins: ['link', 'lists', 'autolink', 'image', 'table', 'codesample', 'preview'],
				toolbar: [
					'undo redo | styleselect fontselect fontsizeselect | removeformat preview',
					'bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignfull | numlist bullist outdent indent | image table codesample'
				],
				style_formats: [
					{ title: 'Fließtext', selector: 'p' },
					{ title: 'Überschrift 1', block: 'h1' },
					{ title: 'Überschrift 2', block: 'h3' },
					{ title: 'Überschrift 3', block: 'h5' },
					{
						title: 'Wichtig',
						inline: 'span',
						styles: {
							backgroundColor: '#ff0000',
							color: '#fff',
							fontFamily: 'impact',
							fontSize: '24px'
						}
					}
				],
				font_formats:
					'JobRouter="Open Sans","Arial Unicode MS",Arial,Helvetica,sans-serif;Impact=impact, sans-serif;Courier New=courier new,courier,monospace;Segoe UI Light="Segoe UI Light";Copperplate Gothic Bold="Copperplate Gothic Bold"',
				fontsize_formats: '8px 10px 12px 14px 16px 18px 24px 36px 48px',
				content_css: window.location.origin + window.location.pathname.replace('index.php','') + 'data/ws_utils/' + WS.conf.version() + '/tinymce/ws-inline.css?foo=' + new Date().getTime(),
				setup: function (editor) {
					editor.on('init', function () {
						if(editorContent) {
							editor.setContent(editorContent);
						}
					});
				}
			};
		}
	}
};