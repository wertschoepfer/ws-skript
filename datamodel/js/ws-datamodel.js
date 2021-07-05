/*global WS*/
(function () {
    WS.dataModel = {
        create: function (appConfig) {
            appConfig = appConfig || {};
            var model = {};
            var hookIntoJRsBrokenDateImplementation = false;
            var loadingString = '⌛ wird aktualisiert';
            var appRenderers = appConfig.renderers || {};
            var appDependencies = appConfig.dependencies || {};
            var appListeners = appConfig.listeners || {};
            var renderersInitialized = false;
            var defaultRenderer = function () {
                return true;
            };
            var subtableViewNames = [];

            WS.each(WS.get('table.subtableView'), function () {
                subtableViewNames.push(this.id);
            });

            var bindElements = function (elements) {
                WS.each(elements, function (index, element) {
                    var property = element.id;

                    if (
                        WS.isNode(element) &&
                        element.type !== 'radio' &&
                        (element.classList.contains('ui-autocomplete-input') ||
                            element.classList.contains('stv_autocomplete'))
                    ) {
                        property = element.id.replace('display_', '');
                    }

                    var elementConfig = {
                        isSubtableElement: false,
                        hasCustomRenderer: false,
                        dependencies: [],
                        listeners: null,
                        render: defaultRenderer
                    };

                    if (element.type === 'radio') {
                        elementConfig = jQuery.extend(elementConfig, element);
                    } else {
                        elementConfig.element = element;
                    }

                    if (isSubtableElement(element)) {
                        elementConfig.isSubtableElement = true;
                        var path = normalizeSubtableProperyPath(property);

                        if (
                            appRenderers[path[0]] &&
                            appRenderers[path[0]][path[2]] &&
                            typeof appRenderers[path[0]][path[2]] === 'function'
                        ) {
                            elementConfig.render = appRenderers[path[0]][path[2]];
                            elementConfig.hasCustomRenderer = true;
                        }

                        if (
                            appListeners[path[0]] &&
                            appListeners[path[0]][path[2]] &&
                            typeof appListeners[path[0]][path[2]] === 'function'
                        ) {
                            elementConfig.listeners = appListeners[path[0]][path[2]];
                        }

                        var pathIterator = model;
                        var end = path.length - 1;

                        for (var i = 0; i <= end; i++) {
                            var currentProp = path[i];

                            if (i === end) {
                                registerLeaf(pathIterator, currentProp, elementConfig);
                                continue;
                            }

                            // eslint-disable-next-line no-prototype-builtins
                            if (!pathIterator.hasOwnProperty(currentProp)) {
                                registerNode(pathIterator, currentProp);
                            }

                            pathIterator = pathIterator[currentProp];
                        }

                        model[path[0]].dependencies = [];

                        // eslint-disable-next-line no-prototype-builtins
                        if (appDependencies[path[0]]) {
                            model[path[0]].dependencies = appDependencies[path[0]];
                        }
                    } else {
                        if (appDependencies[property]) {
                            elementConfig.dependencies = appDependencies[property];
                        }

                        if (appRenderers[property] && typeof appRenderers[property] === 'function') {
                            elementConfig.render = appRenderers[property];
                            elementConfig.hasCustomRenderer = true;
                        }

                        if (appListeners[property] && typeof appListeners[property] === 'function') {
                            elementConfig.listeners = appListeners[property];
                        }

                        registerLeaf(model, property, elementConfig);
                    }
                });

                if (!renderersInitialized) {
                    renderersInitialized = true;

                    document.addEventListener('change', function (evt) {
                        if (model[evt.target.id]) {
                            renderLeaf(model[evt.target.id], 'value');
                            return;
                        }
                        if (evt.target.classList.contains('ui-autocomplete-input')) {
                            var autocompleteId = evt.target.id.replace('display_', '');

                            if (model[autocompleteId]) {
                                renderLeaf(model[autocompleteId], 'value');
                            }
                        }

                        if (evt.target.classList.contains('jr-radio') && model[evt.target.name]) {
                            renderLeaf(model[evt.target.name], 'value');
                        }

                        if (isSubtableElement(evt.target)) {
                            var subtableElementId = evt.target.id;

                            if (evt.target.classList.contains('stv_autocomplete')) {
                                subtableElementId = subtableElementId.replace('display_', '');
                            }

                            var path = normalizeSubtableProperyPath(subtableElementId);

                            //TODO: Build WS.traverse function
                            if (model[path[0]] && model[path[0]][path[1]] && model[path[0]][path[1]][path[2]]) {
                                renderLeaf(model[path[0]][path[1]][path[2]], 'value');
                            }
                        }
                    });

                    if (hookIntoJRsBrokenDateImplementation) {
                        var tmp = $JR.UTILITY.getCompleteDate;
                        $JR.UTILITY.getCompleteDate = function (elementId, dateFormat, includeTime, timePrefix) {
                            if (model[elementId]) {
                                renderLeaf(model[elementId], 'value', function () {
                                    tmp(elementId, dateFormat, includeTime, timePrefix);
                                });
                            }
                        };
                    }

                    if (appListeners) {
                        var listenerTypes = [];
                        WS.each(appListeners, function () {
                            WS.each(this, function (listenerType) {
                                if (WS.isObj(this)) {
                                    WS.each(this, function (subtableListernerType) {
                                        if (listenerTypes.indexOf(subtableListernerType) < 0) {
                                            listenerTypes.push(subtableListernerType);
                                        }
                                    });
                                    return;
                                }

                                if (listenerTypes.indexOf(listenerType) < 0) {
                                    listenerTypes.push(listenerType);
                                }
                            });
                        });

                        WS.each(listenerTypes, function () {
                            var type = this;
                            document.addEventListener(type, function (evt) {
                                if (isSubtableElement(evt.target)) {
                                    var path = normalizeSubtableProperyPath(evt.target.id);

                                    if (
                                        appListeners[path[0]] &&
                                        appListeners[path[0]][path[2]] &&
                                        typeof appListeners[path[0]][path[2]][type] === 'function'
                                    ) {
                                        appListeners[path[0]][path[2]][type].apply(
                                            model[path[0]][path[1]][path[2]],
                                            [model[path[0]][path[1]]],
                                            model
                                        );
                                    }

                                    if (
                                        appListeners['global'] &&
                                        appListeners['global'][type] &&
                                        typeof appListeners['global'][type] === 'function'
                                    ) {
                                        appListeners['global'][type].apply(
                                            model[path[0]][path[1]][path[2]],
                                            [model[path[0]][path[1]]],
                                            model
                                        );
                                    }
                                } else if (
                                    model[evt.target.id] &&
                                    (appListeners[evt.target.id] || appListeners['global'])
                                ) {
                                    if (
                                        appListeners[evt.target.id] &&
                                        typeof appListeners[evt.target.id][type] === 'function'
                                    ) {
                                        appListeners[evt.target.id][type].apply(model[evt.target.id], [model]);
                                    }

                                    if (
                                        appListeners['global'] &&
                                        appListeners['global'][type] &&
                                        typeof appListeners['global'][type] === 'function'
                                    ) {
                                        appListeners['global'][type].apply(model[evt.target.id], [model]);
                                    }
                                }
                            });
                        });
                    }
                }
            };

            var unbindElements = function (elements) {
                WS.each(elements, function () {
                    var element = this;
                    var property = element.id;

                    if (element.classList.contains('jr-radio')) {
                        property = element.name;
                    }

                    if (isSubtableElement(element)) {
                        var path = normalizeSubtableProperyPath(property);
                        deleteRecursive(model, path);
                    } else {
                        delete model[property];
                    }
                });
            };

            var registerNode = function (object, property) {
                var node = {};

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,

                    set: function (newValue) {
                        if (WS.isObj(newValue)) {
                            var children = object[property];

                            WS.each(newValue, function (childKey, newChild) {
                                children[childKey] = newChild;
                            });
                        } else {
                            node = newValue;
                        }
                    },
                    get: function () {
                        return node;
                    }
                });
            };

            var registerLeaf = function (object, property, elementConfig) {
                if (WS.isNode(elementConfig.element)) {
                    if (
                        elementConfig.element.classList.contains('jr-dialog-form-table-number') ||
                        elementConfig.element.classList.contains('decimal')
                    ) {
                        registerDecimalLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('textarea') ||
                        elementConfig.element.classList.contains('stv_textarea') ||
                        elementConfig.element.classList.contains('textbox') ||
                        elementConfig.element.classList.contains('stv_textbox') ||
                        elementConfig.element.classList.contains('password') ||
                        elementConfig.element.classList.contains('jr-dialog-form-table-add-rows-count')
                    ) {
                        registerDefaultInputLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('jr-checkbox') ||
                        elementConfig.element.classList.contains('stv_checkbox')
                    ) {
                        registerCheckboxLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('jr-btn') ||
                        elementConfig.element.classList.contains('stv_button')
                    ) {
                        registerButtonLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('jr-dialog-form-date') ||
                        elementConfig.element.classList.contains('stv_date') ||
                        elementConfig.element.classList.contains('stv_datetime')
                    ) {
                        registerDateLeaf(object, property, elementConfig);
                        hookIntoJRsBrokenDateImplementation = true;
                    } else if (
                        elementConfig.element.classList.contains('file') ||
                        elementConfig.element.classList.contains('stv_file')
                    ) {
                        registerFileLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('ui-autocomplete-input') ||
                        elementConfig.element.classList.contains('stv_autocomplete')
                    ) {
                        registerAutocompleteLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('list') ||
                        elementConfig.element.classList.contains('stv_list') ||
                        elementConfig.element.classList.contains('users') ||
                        elementConfig.element.classList.contains('stv_users')
                    ) {
                        registerListLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('sqlList') ||
                        elementConfig.element.classList.contains('stv_sqllist')
                    ) {
                        registerSqlListLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('sqlTextbox') ||
                        elementConfig.element.classList.contains('stv_sqltextbox')
                    ) {
                        registerSqlTextboxLeaf(object, property, elementConfig);
                    } else if (elementConfig.element.classList.contains('sqlTable')) {
                        registerSqlTableLeaf(object, property, elementConfig);
                    } else if (
                        elementConfig.element.classList.contains('text') ||
                        elementConfig.element.classList.contains('stv_text') ||
                        elementConfig.element.classList.contains('stv_image')
                    ) {
                        registerTextLeaf(object, property, elementConfig);
                    } else if (elementConfig.element.classList.contains('jr-dialog-form-element-description')) {
                        registerDescriptionLeaf(object, property, elementConfig);
                    }
                } else if (elementConfig.type === 'radio') {
                    registerRadioLeaf(object, property, elementConfig);
                } else {
                    registerTrivialLeaf(object, property, elementConfig);
                }
            };

            var registerDecimalLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'decimalLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.value !== newValue) {
                            element.value = formatter.convertFrom.decimal(newValue);
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return formatter.convertTo.decimal(element.value);
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'readonly', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.readOnly = true;
                        } else {
                            element.readOnly = false;
                        }
                        renderLeaf(leaf, 'readonly');
                    },
                    get: function () {
                        return element.readOnly;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerDateLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;
                var calendar = null;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                if (element.classList.contains('datetime') || element.classList.contains('stv_datetime')) {
                    calendar = document.getElementById(element.id + '_SelectDate');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'dateLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newDate) {
                        if (newDate == '') {
                            element.value = '';
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                            return;
                        }

                        if (
                            (leaf.value === '' && newDate instanceof Date) ||
                            (newDate instanceof Date && newDate.getTime() !== leaf.value.getTime())
                        ) {
                            element.value = formatter.convertFrom.date(newDate);
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        } else if (typeof newDate === 'string') {
                            var tmp = new Date(newDate);

                            if (tmp instanceof Date) {
                                element.value = formatter.convertFrom.date(tmp);
                                renderLeaf(leaf, 'value');
                                dispatchSetterEvents(leaf.node);
                                //GBU - TODO: Fix validation class error
                                //$JR.DIALOG.VALIDATION.trim(element.id);
                            }
                        }
                    },
                    get: function () {
                        return formatter.convertTo.date(element.value);
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'readonly', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.readOnly = true;
                            if (calendar) {
                                calendar.style.visibility = 'hidden';
                            }
                        } else {
                            element.readOnly = false;
                            if (calendar) {
                                calendar.style.visibility = 'visible';
                            }
                        }
                        renderLeaf(leaf, 'readonly');
                    },
                    get: function () {
                        return element.readOnly;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerCheckboxLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'checkboxLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (typeof newValue === 'boolean') {
                            element.checked = newValue;
                        } else if (newValue == 1 || newValue == 0) {
                            element.checked = newValue == 1;
                        } else {
                            element.checked = newValue === 'Y';
                        }

                        renderLeaf(leaf, 'value');
                        dispatchSetterEvents(leaf.node);
                    },
                    get: function () {
                        return element.checked;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerButtonLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }
                var leaf = {
                    _rendering: false,
                    _type: 'buttonLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.innerHTML != newValue) {
                            element.innerHTML = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return element.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function () {
                        console.log('There is no required attribute for button elements.');
                    },
                    get: function () {
                        return false;
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            if (!elementContainer) {
                                element.style.display = '';
                            } else {
                                elementContainer.style.display = '';
                            }
                        } else {
                            if (!elementContainer) {
                                element.style.display = 'none';
                            } else {
                                elementContainer.style.display = 'none';
                            }
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        if (!elementContainer) {
                            return element.style.display != 'none';
                        }
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerRadioLeaf = function (object, property, elementConfig) {
                var elements = elementConfig.elements;

                var leaf = {
                    _rendering: false,
                    _type: 'radioLeaf',
                    _visible: undefined,
                    _disabled: undefined,
                    _required: undefined,
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    listeners: elementConfig.listeners,
                    dependencies: elementConfig.dependencies || []
                };

                WS.each(elements, function (index) {
                    var childRef = (leaf[this.value] = {});

                    Object.defineProperty(childRef, 'node', {
                        enumerable: true,
                        configurable: true,
                        set: function (newElement) {
                            elements[index] = newElement;
                        },
                        get: function () {
                            return elements[index];
                        }
                    });

                    //TODO retrieveFromSTVHeaderElement returns always always first radio column
                    if (elementConfig.isSubtableElement) {
                        elementLabel = document
                            .getElementById(retrieveFromSTVHeaderElement(elements[index].id))
                            .querySelector('span');
                    } else {
                        elementLabel = document.getElementById(elements[index].id + '_label');
                    }

                    Object.defineProperty(childRef, 'label', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            elementLabel.innerHTML = newValue;
                            renderLeaf(leaf, 'label');
                        },
                        get: function () {
                            return elementLabel.innerHTML;
                        }
                    });

                    var elementLabel2 = document.getElementById(elements[index].id + '_label2');

                    Object.defineProperty(childRef, 'label2', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            elementLabel2.innerHTML = newValue;
                            renderLeaf(leaf, 'label2');
                        },
                        get: function () {
                            return elementLabel2.innerHTML;
                        }
                    });

                    Object.defineProperty(childRef, 'required', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (newValue) {
                                elementLabel.classList.add('jr-required-field');
                                elements[index].classList.add('one-required');
                            } else {
                                elementLabel.classList.remove('jr-required-field');
                                elements[index].classList.remove('one-required');
                            }
                            leaf._required = undefined;
                            renderLeaf(leaf, 'required');
                        },
                        get: function () {
                            return elements[index].classList.contains('one-required');
                        }
                    });

                    Object.defineProperty(childRef, 'disabled', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            elements[index].disabled = newValue;
                            leaf._disabled = undefined;
                            renderLeaf(leaf, 'disabled');
                        },
                        get: function () {
                            return elements[index].disabled === true;
                        }
                    });

                    var elementContainer = elements[index].parentNode;

                    Object.defineProperty(childRef, 'visible', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (newValue == 1 || newValue === 'Y') {
                                elementContainer.style.display = '';
                            } else {
                                elementContainer.style.display = 'none';
                            }
                            leaf._visible = undefined;
                            renderLeaf(leaf, 'visible');
                        },
                        get: function () {
                            if (!elementContainer) {
                                return element.style.display != 'none';
                            }
                            return elementContainer.style.display !== 'none';
                        }
                    });
                });

                Object.defineProperty(leaf, 'nodes', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElements) {
                        elements = newElements;
                    },
                    get: function () {
                        return elements;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (elements[newValue]) {
                            elements[newValue].checked = true;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(elements[newValue]);
                        }
                    },
                    get: function () {
                        var leafVal = '';
                        WS.each(elements, function () {
                            if (this.checked) {
                                leafVal = this.value;
                            }
                        });
                        return leafVal;
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        WS.each(elements, function () {
                            this.disabled = newValue;
                        });

                        leaf._disabled = newValue;
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return leaf._disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        WS.each(elements, function () {
                            object[property][this.value]['visible'] = newValue;
                        });
                        leaf._visible = newValue === true;
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return leaf._visible;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        WS.each(elements, function () {
                            object[property][this.value]['required'] = newValue;
                        });
                        leaf._required = newValue;
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return leaf._required;
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });

                var tmpVisible = undefined,
                    tmpRequired = undefined,
                    tmpDisabled = undefined;

                WS.each(elements, function () {
                    if (this.disabled != leaf._disabled) {
                        if (tmpDisabled === undefined) {
                            tmpDisabled = this.disabled;
                        }
                        leaf._disabled = this.disabled;
                    }

                    var ref = object[property][this.value];

                    if (ref.visible != leaf._visible) {
                        if (tmpVisible === undefined) {
                            tmpVisible = ref.visible;
                        }
                        leaf._visible = ref.visible;
                    }

                    if (ref.required != leaf._required) {
                        if (tmpRequired === undefined) {
                            tmpRequired = ref.required;
                        }
                        leaf._required = ref.required;
                    }
                });

                if (leaf._disabled != tmpDisabled) {
                    leaf._disabled = undefined;
                }

                if (leaf._visible != tmpVisible) {
                    leaf._visible = undefined;
                }

                if (leaf._required != tmpRequired) {
                    leaf._required = undefined;
                }
            };

            var registerDefaultInputLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'defaultInputLeaf',
                    render: elementConfig.render,
                    _customRender: elementConfig.hasCustomRenderer,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.value !== newValue) {
                            element.value = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return element.value;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'readonly', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.readOnly = true;
                        } else {
                            element.readOnly = false;
                        }
                        renderLeaf(leaf, 'readonly');
                    },
                    get: function () {
                        return element.readOnly;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            if (!elementContainer) {
                                element.style.display = '';
                            } else {
                                elementContainer.style.display = '';
                            }
                        } else {
                            if (!elementContainer) {
                                element.style.display = 'none';
                            } else {
                                elementContainer.style.display = 'none';
                            }
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        if (!elementContainer) {
                            return element.style.display != 'none';
                        }
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerDescriptionLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementContainer = document.getElementById('div_' + element.id);

                var leaf = {
                    _rendering: false,
                    _type: 'descriptionLeaf',
                    render: elementConfig.render,
                    _customRender: elementConfig.hasCustomRenderer,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.innerHTML != newValue) {
                            element.innerHTML = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return element.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerTextLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'textLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.innerHTML != newValue) {
                            element.innerHTML = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return element.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerSqlTableLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel = document.getElementById(element.id + '_label');
                var elementContainer = document.getElementById('div_' + element.id);

                var columnMappings = [];
                if ($JRApp.registry.getComponent(property)) {
                    WS.each($JRApp.registry.getComponent(property)._columns, function (index) {
                        columnMappings[index] = this.name;
                    });
                }

                var leaf = {
                    _rendering: false,
                    _type: 'sqlTableLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    dtTable: jQuery(element).find('table.dataTable').DataTable(),
                    isSubtableElement: false,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        //elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                if (elementLabel) {
                    Object.defineProperty(leaf, 'label', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            elementLabel.innerHTML = newValue;
                            renderLeaf(leaf, 'label');
                        },
                        get: function () {
                            return elementLabel.innerHTML;
                        }
                    });
                }

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(leaf, '_loading', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue || newValue == 1 || newValue == 'Y') {
                            element.innerHTML = loadingString;
                            return;
                        }

                        leaf._cache = null;
                    },
                    get: function () {
                        return element.innerHTML === loadingString;
                    }
                });

                var loadTableData = function () {
                    WS.each(leaf, function (attribute) {
                        if (isNaN(attribute)) {
                            return;
                        }

                        delete leaf[attribute];
                    });

                    WS.each(leaf.dtTable.rows().data().toArray(), function (rowId) {
                        leaf[rowId] = {};
                        WS.each(this, function (colIndex) {
                            //Todo: Createtablecellleaf based on textleaf
                            leaf[rowId][columnMappings[colIndex]] = this;
                        });
                    });
                };
                loadTableData();

                leaf.rows = function () {
                    var rows = [];
                    WS.each(leaf, function (attribute) {
                        if (isNaN(attribute)) {
                            return;
                        }

                        rows.push(this);
                    });
                    return rows;
                };

                leaf.refresh = function (callback) {
                    leaf._loading = true;

                    WS.sqlRefresh(leaf, function (response) {
                        if (response.status === 'success') {
                            $JRApp.registry.unregisterComponent(leaf.name);
                            jQuery(elementContainer).replaceWith(response.value);
                            elementContainer = document.getElementById('div_' + element.id);
                            leaf.node = elementContainer.querySelector('div.sqlTable');
                            leaf.dtTable = jQuery(element).find('table.dataTable').DataTable();
                            leaf._loading = false;
                            loadTableData();
                            renderLeaf(leaf, 'refresh');
                            if (callback && typeof callback === 'function') {
                                callback.apply(leaf);
                            }
                        }
                    });
                };

                if (appListeners[property]) {
                    WS.each(appListeners[property], function (type) {
                        elementContainer.addEventListener(type, function (evt) {
                            appListeners[property][type].apply(evt.srcElement.innerHTML, [
                                leaf[evt.srcElement.parentNode.rowIndex - 1]
                            ]);
                        });
                    });
                }

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerSqlListLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var initialDisabled = element.disabled;
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _cache: null,
                    _rendering: false,
                    _autoCompleteMode: 'display',
                    _type: 'sqlListLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, '_loading', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue || newValue == 1 || newValue == 'Y') {
                            leaf._cache = leaf.value;
                            element.innerHTML = '<option>' + loadingString + '</option>';
                            element.disabled = true;
                            return;
                        }

                        leaf._cache = null;
                        element.disabled = initialDisabled;
                    },
                    get: function () {
                        return element.innerHTML === '<option>' + loadingString + '</option>';
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        //Falls sql-liste "Leere Auswahl" aktiv hat, kann man hierdurch nicht den Wert auf leere Auswahl setzen
                        /*if(!newValue) {
							return;
						}*/

                        newValue = newValue.toString();

                        if (leaf._loading) {
                            leaf._cache = newValue;
                            return;
                        }

                        if (element.value != newValue) {
                            WS.each(element.querySelectorAll('option'), function () {
                                if (this.value === newValue) {
                                    element.value = newValue;
                                    renderLeaf(leaf, 'value');
                                    dispatchSetterEvents(leaf.node);
                                    return false;
                                }
                            });
                        }
                    },
                    get: function () {
                        if (leaf._loading) {
                            return leaf._cache;
                        }

                        return element.value;
                    }
                });

                Object.defineProperty(leaf, 'displayValue', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        var determinedValue = undefined;

                        WS.each(element.querySelectorAll('option'), function () {
                            if (this.innerHTML === newValue) {
                                determinedValue = this.value;
                            }
                        });

                        if (determinedValue) {
                            element.value = determinedValue;
                            renderLeaf(leaf, 'displayValue');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        if (element.selectedIndex === -1) {
                            return '';
                        }

                        return element.options[element.selectedIndex].innerHTML;
                    }
                });

                leaf.refresh = function (callback) {
                    initialDisabled = leaf.disabled;
                    leaf._loading = true;

                    if (leaf.isSubtableElement) {
                        WS.subtableRefresh(leaf, function (response) {
                            if (response.status === 'success') {
                                var container = document.createElement('div');
                                container.innerHTML = response.values[leaf.node.id];
                                var tmpSelect = container.querySelector('select');
                                element.innerHTML = tmpSelect.innerHTML;
                                element.value = leaf._cache;
                            } else {
                                element.value = '';
                            }

                            leaf._loading = false;
                            renderLeaf(leaf, 'refresh');
                            if (callback && typeof callback === 'function') {
                                callback.apply(leaf);
                            }
                        });
                    } else {
                        WS.sqlRefresh(leaf, function (response) {
                            if (response.status === 'success') {
                                var container = document.createElement('div');
                                container.innerHTML = response.value;
                                var tmpSelect = container.querySelector('select');
                                element.innerHTML = tmpSelect.innerHTML;
                                element.value = leaf._cache;
                            } else {
                                element.value = '';
                            }

                            leaf._loading = false;
                            renderLeaf(leaf, 'refresh');
                            if (callback && typeof callback === 'function') {
                                callback.apply(leaf);
                            }
                        });
                    }
                };

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerAutocompleteLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementName,
                    /** @type {HTMLElement} */ elementLabel,
                    elementLabel2,
                    hiddenElement,
                    elementContainer;
                var initialDisabled = element.disabled;

                /*
					this is if neccessary for subtable elements,
					otherwise those would get registered in model under
					subtablename.rowId.subtablename_columname_rowId
					-> potential candidate for refactoring.
				*/
                if (elementConfig.isSubtableElement) {
                    elementName = element.id.replace('display_', '');
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                    elementLabel2 = document.getElementById(elementName + '_label2');
                    hiddenElement = document.getElementById(elementName);
                    elementContainer = document.getElementById('div_' + elementName);
                } else {
                    elementLabel =
                        document.getElementById(property + '_label') ||
                        // Bugfix: setting required on an autocomplete sql list throws a null error
                        // Reason: "property" is stripped of the "display_" prefix, so the above selector returns null
                        document.getElementById('display_' + property + '_label');
                    property = property.replace('display_', '');
                    elementName = property;
                    elementLabel2 = document.getElementById(property + '_label2');
                    hiddenElement = document.getElementById(property);
                    elementContainer = document.getElementById('div_' + property);
                }

                var leaf = {
                    _cache: null,
                    _rendering: false,
                    _autoCompleteMode: 'display',
                    _type: 'sqlAutocompleteLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: elementName,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, '_loading', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue || newValue == 1 || newValue == 'Y') {
                            leaf._cache = leaf.value;
                            element.value = loadingString;
                            element.disabled = true;
                            return;
                        }

                        leaf._cache = null;
                        element.disabled = initialDisabled;
                    },
                    get: function () {
                        return element.value === loadingString;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (leaf._loading) {
                            leaf._cache = newValue;
                            return;
                        }

                        if (hiddenElement.value != newValue) {
                            hiddenElement.value = newValue;
                            element.value = newValue;
                            leaf._autoCompleteMode = 'value';
                            leaf.refresh(function () {
                                renderLeaf(leaf, 'value');
                                dispatchSetterEvents(leaf.node);
                            });
                        }
                    },
                    get: function () {
                        if (leaf._loading) {
                            return leaf._cache;
                        }

                        return hiddenElement.value;
                    }
                });

                Object.defineProperty(leaf, 'displayValue', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.value != newValue) {
                            element.value = newValue;
                            hiddenElement.value = '';
                            leaf._autoCompleteMode = 'display';
                            leaf.refresh(function () {
                                renderLeaf(leaf, 'displayValue');
                                dispatchSetterEvents(leaf.node);
                            });
                        }
                    },
                    get: function () {
                        return element.value;
                    }
                });

                leaf.refresh = function (callback) {
                    leaf._oldDisplayValue = element.value;
                    leaf._oldValue = hiddenElement.value;
                    initialDisabled = leaf.disabled;
                    leaf._loading = true;
                    element.classList.add('validation-failed');

                    WS.sqlRefresh(leaf, function (response) {
                        element.value = leaf._cache;

                        if (response.value != '' && response.display != '') {
                            hiddenElement.value = response.value;
                            element.value = response.display;
                            element.classList.remove('validation-failed');
                        }

                        if (response.value === '' && response.display === '') {
                            element.classList.remove('validation-failed');
                        }

                        leaf._oldDisplayValue = null;
                        leaf._oldValue = null;
                        leaf._loading = false;

                        renderLeaf(leaf, 'refresh');
                        if (callback && typeof callback === 'function') {
                            callback.apply(leaf);
                        }
                    });
                };

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerListLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'ListLeaf',
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (element.value != newValue) {
                            element.value = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        return element.value;
                    }
                });

                Object.defineProperty(leaf, 'displayValue', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        var determinedValue = undefined;

                        WS.each(element.querySelectorAll('option'), function () {
                            if (this.innerHTML === newValue) {
                                determinedValue = this.value;
                            }
                        });

                        if (determinedValue) {
                            element.value = determinedValue;
                            renderLeaf(leaf, 'displayValue');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        if (element.selectedIndex === -1) {
                            return '';
                        }

                        return element.options[element.selectedIndex].innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerSqlTextboxLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementLabel2 = document.getElementById(element.id + '_label2');
                var elementContainer = document.getElementById('div_' + element.id);
                var initialDisabled = element.disabled;
                var elementLabel;

                if (elementConfig.isSubtableElement) {
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(element.id))
                        .querySelector('span');
                } else {
                    elementLabel = document.getElementById(element.id + '_label');
                }

                var leaf = {
                    _rendering: false,
                    _type: 'sqlTextboxLeaf',
                    _cache: null,
                    _customRender: elementConfig.hasCustomRenderer,
                    render: elementConfig.render,
                    name: property,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, '_loading', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue || newValue == 1 || newValue == 'Y') {
                            leaf._cache = leaf.value;
                            element.value = loadingString;
                            element.disabled = true;
                            return;
                        }

                        leaf._cache = null;
                        element.disabled = initialDisabled;
                    },
                    get: function () {
                        return element.value === loadingString;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (leaf._loading) {
                            leaf._cache = newValue;
                            return;
                        }

                        if (element.value != newValue) {
                            element.value = newValue;
                            renderLeaf(leaf, 'value');
                            dispatchSetterEvents(leaf.node);
                        }
                    },
                    get: function () {
                        if (leaf._loading) {
                            return leaf._cache;
                        }

                        return element.value;
                    }
                });

                leaf.refresh = function (callback) {
                    initialDisabled = leaf.disabled;
                    leaf._loading = true;

                    if (leaf.isSubtableElement) {
                        WS.subtableRefresh(leaf, function (response) {
                            if (response.status === 'success') {
                                var container = document.createElement('div');
                                var selector = leaf._subtable._viewName + '_' + leaf._columnName + '_' + leaf._rowId;
                                container.innerHTML = response.values[selector];
                                var tmpField = container.querySelector('input');
                                leaf._loading = false;
                                element.value = tmpField.value;
                                renderLeaf(leaf, 'refresh');
                                if (callback && typeof callback === 'function') {
                                    callback.apply(leaf);
                                }
                            }
                        });
                    } else {
                        WS.sqlRefresh(leaf, function (response) {
                            if (response.status === 'success') {
                                var container = document.createElement('div');
                                container.innerHTML = response.value;
                                var tmpField = container.querySelector('input');
                                leaf._loading = false;
                                element.value = tmpField.value;
                                renderLeaf(leaf, 'refresh');
                                if (callback && typeof callback === 'function') {
                                    callback.apply(leaf);
                                }
                            }
                        });
                    }
                };

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'label2', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel2.innerHTML = newValue;
                        renderLeaf(leaf, 'label2');
                    },
                    get: function () {
                        return elementLabel2.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.disabled = true;
                        } else {
                            element.disabled = false;
                        }
                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'readonly', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            element.readOnly = true;
                        } else {
                            element.readOnly = false;
                        }
                        renderLeaf(leaf, 'readonly');
                    },
                    get: function () {
                        return element.readOnly;
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var registerFileLeaf = function (object, property, elementConfig) {
                var element = elementConfig.element;
                var elementId, elementLabel, elementContainer;
                property = property.replace('_uploaded', '');

                if (elementConfig.isSubtableElement) {
                    var path = normalizeSubtableProperyPath(element.id);
                    elementId = path[0] + '_' + path[2] + '_' + path[1];
                    elementLabel = document
                        .getElementById(retrieveFromSTVHeaderElement(elementId))
                        .querySelector('span');
                    elementContainer = document
                        .getElementById('div_' + elementId)
                        .querySelector('.jr-file-upload-controls');
                } else {
                    elementId = property.replace('_uploaded', '');
                    elementLabel = document.getElementById(elementId + '_label');
                    elementContainer = document.getElementById('div_' + elementId);
                }

                var uploadElement = document.getElementById(elementId + '_showUploadForm');
                var showElement = document.getElementById(elementId + '_showUploadedFile');
                var removeElement = document.getElementById(elementId + '_removeUploadedFile');

                var leaf = {
                    _rendering: false,
                    _type: 'fileLeaf',
                    render: elementConfig.render,
                    _customRender: elementConfig.hasCustomRenderer,
                    name: elementId,
                    isSubtableElement: elementConfig.isSubtableElement,
                    dependencies: elementConfig.dependencies || [],
                    listeners: elementConfig.listeners,
                    skipDependencies: false
                };

                Object.defineProperty(leaf, 'node', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        if (!WS.isNode(newElement)) {
                            return;
                        }
                        elementContainer.replaceChild(newElement, element);
                        element = newElement;
                    },
                    get: function () {
                        return element;
                    }
                });

                Object.defineProperty(leaf, 'showElement', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        showElement = newElement;
                    },
                    get: function () {
                        return showElement;
                    }
                });

                Object.defineProperty(leaf, 'removeElement', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        removeElement = newElement;
                    },
                    get: function () {
                        return removeElement;
                    }
                });

                Object.defineProperty(leaf, 'uploadElement', {
                    enumerable: true,
                    configurable: true,
                    set: function (newElement) {
                        uploadElement = newElement;
                    },
                    get: function () {
                        return uploadElement;
                    }
                });

                Object.defineProperty(leaf, 'value', {
                    enumerable: true,
                    configurable: true,
                    set: function () {
                        console.log('Its not possible to set the value of a file element.');
                    },
                    get: function () {
                        return element.value;
                    }
                });

                Object.defineProperty(leaf, 'label', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        elementLabel.innerHTML = newValue;
                        renderLeaf(leaf, 'label');
                    },
                    get: function () {
                        return elementLabel.innerHTML;
                    }
                });

                Object.defineProperty(leaf, 'required', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue) {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.add('jr-required-field');
                            }
                            element.classList.add('required');
                        } else {
                            if (!leaf.isSubtableElement) {
                                elementLabel.classList.remove('jr-required-field');
                            }
                            element.classList.remove('required');
                        }
                        renderLeaf(leaf, 'required');
                    },
                    get: function () {
                        return element.classList.contains('required');
                    }
                });

                Object.defineProperty(leaf, 'disabled', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            showElement.style.display = 'none';
                            removeElement.style.display = 'none';
                            uploadElement.disabled = true;
                            element.disabled = true;
                        } else {
                            showElement.style.display = '';
                            removeElement.style.display = '';
                            uploadElement.disabled = false;
                            element.disabled = false;
                        }

                        renderLeaf(leaf, 'disabled');
                    },
                    get: function () {
                        return element.disabled;
                    }
                });

                Object.defineProperty(leaf, 'readonly', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            showElement.style.display = '';
                            uploadElement.style.display = 'none';
                            removeElement.style.display = 'none';
                        } else {
                            showElement.style.display = '';
                            uploadElement.style.display = '';
                            removeElement.style.display = '';
                        }

                        renderLeaf(leaf, 'readonly');
                    },
                    get: function () {
                        return uploadElement.style.display === 'none';
                    }
                });

                Object.defineProperty(leaf, 'visible', {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        if (newValue == 1 || newValue === 'Y') {
                            elementContainer.style.display = '';
                        } else {
                            elementContainer.style.display = 'none';
                        }
                        renderLeaf(leaf, 'visible');
                    },
                    get: function () {
                        return elementContainer.style.display != 'none';
                    }
                });

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,
                    set: function (newValue) {
                        console.log(
                            'It is not allowed to overwrite the "' +
                                property +
                                '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                property +
                                '.value instead. (You should change your code!)'
                        );
                        leaf.value = newValue;
                        return false;
                    },
                    get: function () {
                        return leaf;
                    }
                });
            };

            var renderedQueue = [];
            var initialType = null;
            var sqlElements = ['sqlListLeaf', 'sqlAutocompleteLeaf', 'sqlTextboxLeaf', 'sqlTableLeaf'];
            var refreshTypes = ['refresh', 'value', 'displayValue']; // [ ? , J ,  ?]

            var renderLeaf = function (leaf, type, callback) {
                var resetRendering = false;

                if (renderedQueue.length === 0) {
                    resetRendering = true;
                    initialType = type;
                }

                if (leaf._rendering) {
                    return;
                }

                leaf._rendering = true;
                renderedQueue.push(leaf);

                var invokeDependency = function (dependendLeaf) {
                    //Idee: render Queue auf Element ebene. Wenn das Element ein weiteres Mal gerendert werden soll, render Anfrage in Queue und der Reihe nach ausführen.

                    // Korrekt, da dies die dependency Calls sind.
                    //Refresh nur bei Value?
                    //initial dep, muss nicht übergeben werden, da im scope korrekt enthalten?
                    if (
                        sqlElements.indexOf(dependendLeaf._type) > -1 &&
                        (refreshTypes.indexOf(type) > -1 ||
                            (type === 'dependency' && refreshTypes.indexOf(initialType) > -1))
                    ) {
                        dependendLeaf.refresh(); // Soll überhaupt immer automatisch ein refresh gemacht werden oder lieber
                        //mit dependency und dann innerhalb des Aufrufs einen refresh ausführen?
                    } else {
                        renderLeaf(dependendLeaf, 'dependency'); //, type); ??
                    }
                };

                if (leaf.isSubtableElement) {
                    leaf.render.apply(leaf, [leaf._row, type, model, initialType]);
                    if (!leaf.skipDependencies) {
                        WS.each(leaf._subtable.dependencies[leaf.name], function () {
                            if (this.indexOf('model.') > -1) {
                                invokeDependency(model[this.replace('model.', '')]);
                            } else if (leaf._row[this]) {
                                invokeDependency(leaf._row[this]);
                            }
                        });
                    }
                } else {
                    leaf.render.apply(leaf, [model, type, initialType]);
                    if (!leaf.skipDependencies) {
                        WS.each(leaf.dependencies, function () {
                            if (this.indexOf('.') > -1) {
                                var path = this.split('.');

                                if (model[path[0]] && model[path[0]].columns) {
                                    WS.each(model[path[0]].columns(path[1]), function () {
                                        invokeDependency(this);
                                    });
                                }
                                return;
                            }

                            if (model[this]) {
                                invokeDependency(model[this]);
                            }
                        });
                    }
                }

                leaf.skipDependencies = false;

                if (resetRendering) {
                    WS.each(renderedQueue, function () {
                        this._rendering = false;
                        if (this._cache) {
                            var tmp = this._cache;
                            this._cache = null;
                            this.value = tmp;
                        }
                    });
                    initialType = null;
                    renderedQueue = [];

                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
            };

            //TOOD: is a registration vor trivial types even neccessary?
            var registerTrivialLeaf = function (object, property, value) {
                var leaf = {
                    value: value,
                    name: property,
                    type: 'trivialLeaf'
                };

                Object.defineProperty(object, property, {
                    enumerable: true,
                    configurable: true,

                    set: function (newValue) {
                        leaf.value = newValue;
                    },
                    get: function () {
                        return leaf.value;
                    }
                });
            };

            var dispatchSetterEvents = function (element) {
                if (element.onchange) {
                    var changeEvt = new Event('change');
                    element.dispatchEvent(changeEvt);
                }

                if (element.onblur) {
                    var blurEvt = new Event('blur');
                    element.dispatchEvent(blurEvt);
                }
            };

            var formatter = {
                convertFrom: {
                    decimal: function (val) {
                        if (!val) {
                            return 0;
                        }

                        if (val.toString().indexOf('.') > 3) {
                            return val
                                .toString()
                                .replace('.', $JRUSER.decimalSeparator)
                                .replace(/\B(?=(\d{3})+(?!\d))/g, $JRUSER.thousandsSeparator);
                        }

                        return val.toString().replace('.', $JRUSER.decimalSeparator);
                    },

                    date: function (dateObj) {
                        dateObj = moment(dateObj);
                        return dateObj.format($JRUSER.dateFormatString);
                    }
                },
                convertTo: {
                    decimal: function (val) {
                        if ($JRUSER.thousandsSeparator === '.') {
                            val = parseFloat(val.toString().replace(/\./g, '').replace($JRUSER.decimalSeparator, '.'));
                        } else {
                            val = parseFloat(
                                val
                                    .toString()
                                    .replace(new RegExp($JRUSER.thousandsSeparator, 'g'), '')
                                    .replace($JRUSER.decimalSeparator, '.')
                            );
                        }

                        if (isNaN(val)) {
                            return 0.0;
                        }
                        return val;
                    },

                    date: function (dateString) {
                        if (dateString == '') {
                            return dateString;
                        }
                        var unformattedDate = $JR.UTILITY.getUnformattedDate(dateString, $JRUSER.dateFormat);
                        return new Date(unformattedDate);
                    }
                }
            };

            var deleteRecursive = function (object, path) {
                var currentProp = path.shift();

                if (path.length > 0) {
                    deleteRecursive(object[currentProp], path);

                    if (WS.isEmpty(object[currentProp])) {
                        delete object[currentProp];
                    }
                } else {
                    delete object[currentProp];
                }
            };

            var addSubtableFunctions = function () {
                WS.each(WS.get('.subtableView'), function () {
                    var subtableId = this.id;

                    if (!model[subtableId]) {
                        //subtable is empty
                        model[subtableId] = {};
                    }

                    var subtable = model[subtableId];
                    //var subtableRenders = {};
                    var subtableCount = WS.get('#' + subtableId + '_count');
                    var subtableMaxId = WS.get('#' + subtableId + '_max_id');

                    subtable._type = 'subtableNode';

                    Object.defineProperty(subtable, 'count', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            /*console.log('It is not allowed to overwrite the count property of the subtable object.');
							return false;*/
                            if (isNaN(parseInt(newValue))) {
                                return;
                            }
                            subtableCount.value = newValue;
                        },
                        get: function () {
                            return parseInt(subtableCount.value, 10);
                        }
                    });

                    Object.defineProperty(subtable, 'maxRowId', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            /*console.log('It is not allowed to overwrite the maxId property of the subtable object.');
							return false;*/
                            if (isNaN(parseInt(newValue))) {
                                return;
                            }
                            subtableMaxId.value = newValue;
                        },
                        get: function () {
                            return parseInt(subtableMaxId.value, 10);
                        }
                    });

                    /*Object.defineProperty(subtable, 'render', {
						enumerable: true,
						configurable: true,
						set: function (newRender) {

							if(WS.isObj(newRender)) {

								subtableRenders = newRender;

								var columns = subtable.columns();

								WS.each(newRender, function(columnName) {

									var renderFunc = this;

									if(!columns[columnName]) {
										console.log('Skipping render assignment for "' + columnName + '", column does not exist in subtable');
										return;
									}

									if(typeof renderFunc !== 'function') {
										console.log('Skipping render assignment for "' + columnName + '", given renderer is not a function');
										return;
									}

									WS.each(columns[columnName], function() {
										this.render = renderFunc;
									});
								});
							}
						},
						get: function () {
							return subtableRenders;
						},
					});*/

                    subtable.addRows = function (rows, callback) {
                        var setRow = function (row, rowId) {
                            WS.each(row, function (column) {
                                if (subtable[rowId][column]) {
                                    subtable[rowId][column].value = this;
                                }
                            });
                        };

                        var tmpRowId = subtable.maxRowId;

                        if (rows && WS.isArray(rows) && !WS.isEmpty(rows)) {
                            $JR.DIALOG.SUBTABLE.addRows(subtableId, rows.length, 1, function () {
                                WS.each(rows, function () {
                                    tmpRowId++;
                                    setRow(this, tmpRowId);
                                });

                                if (callback && typeof callback === 'function') {
                                    callback.apply(subtable);
                                }
                            });
                        } else if (WS.isObj(rows) && !WS.isEmpty(rows)) {
                            $JR.DIALOG.SUBTABLE.addRows(subtableId, 1, 1, function () {
                                tmpRowId++;
                                setRow(rows, tmpRowId);

                                if (callback && typeof callback === 'function') {
                                    callback.apply(subtable);
                                }
                            });
                        } else if (!isNaN(parseInt(rows))) {
                            $JR.DIALOG.SUBTABLE.addRows(subtableId, rows, 1, function () {
                                if (callback && typeof callback === 'function') {
                                    callback.apply(subtable);
                                }
                            });
                        }
                    };

                    subtable.deleteRows = function (rowIds) {
                        $JR.DIALOG.SUBTABLE.deleteRows(subtableId, rowIds);
                    };

                    subtable.rows = function () {
                        var rows = [];

                        WS.each(subtable, function (index) {
                            if (!isNaN(index)) {
                                //skip methods, get only numeric indexes
                                rows[index] = this;
                            }
                        });

                        return rows;
                    };

                    subtable.init = function (rows) {
                        subtable.deleteRows(WS.keys(subtable.rows()));
                        subtable.maxRowId = 0;
                        subtable.subtableCount = 0;
                        subtable.addRows(rows);
                    };

                    subtable.columns = function (columnFilter) {
                        var columns, mode;

                        if (typeof columnFilter === 'string') {
                            columns = [];
                            mode = 'single';
                        } else if (WS.isArray(columnFilter)) {
                            columns = {};
                            WS.each(columnFilter, function () {
                                columns[this] = [];
                            });

                            mode = 'multiple';
                        } else {
                            columns = {};
                            mode = 'all';
                        }

                        WS.each(subtable.rows(), function (rowId) {
                            switch (mode) {
                                case 'single':
                                    if (this[columnFilter]) {
                                        columns[rowId] = this[columnFilter];
                                    }
                                    break;

                                case 'multiple':
                                    WS.each(this, function (columnName) {
                                        if (columns[columnName]) {
                                            columns[columnName][rowId] = this;
                                        }
                                    });

                                    break;

                                case 'all':
                                    WS.each(this, function (columnName) {
                                        if (!columns[columnName]) {
                                            columns[columnName] = [];
                                        }

                                        columns[columnName][rowId] = this;
                                    });
                                    break;
                            }
                        });

                        return columns;
                    };

                    //hook into JobRouter add / remove subtable callbacks
                    var jrSubtable = $JR.DIALOG.SUBTABLE.getSubtable(this.id);
                    subtable._viewName = jrSubtable.subtableElementName;
                    subtable._subtableName = jrSubtable.subtableName;

                    jrSubtable.afterAddRowCallbacks.push(function (jrSubtableId, insertedRow) {
                        var elements = insertedRow.querySelectorAll(
                            '.stv_radio, .stv_text, .stv_textarea, .stv_textbox, .stv_sqlcheckbox, .stv_sqltextbox, .stv_decimal, .stv_image, .stv_date, .stv_datetime, .stv_file, .stv_button, .stv_checkbox, .stv_list, .stv_sqllist, .stv_autocomplete'
                        );
                        bindElements(elements);
                        var row = subtable.rows().pop();
                        WS.each(row, function (columnName) {
                            this._subtable = subtable;
                            this._row = row;
                            this._rowId = subtable.maxRowId;
                            this._columnName = columnName;
                            this._subtableName = subtable._subtableName;
                        });

                        WS.each(row, function () {
                            // renderer execution has to happen after whole row has been initialized
                            if (this._customRender) {
                                this.render.apply(this, [row, 'add', model]);
                            }
                        });
                    });

                    jrSubtable.afterRemoveRowCallbacks.push(function (jrSubtableId, insertedRow) {
                        var elements = insertedRow.querySelectorAll(
                            '.stv_radio, .stv_text, .stv_textarea, .stv_textbox, .stv_sqlcheckbox, .stv_sqltextbox, .stv_decimal, .stv_image, .stv_date, .stv_datetime, .stv_file, .stv_button, .stv_checkbox, .stv_list, .stv_sqllist, .stv_autocomplete'
                        );
                        unbindElements(elements);
                    });

                    //add subtable reference for dependency resolving
                    WS.each(subtable.rows(), function (rowId) {
                        var row = this;
                        WS.each(this, function (columnName) {
                            this._subtable = subtable;
                            this._row = row;
                            this._rowId = rowId;
                            this._columnName = columnName;
                            this._subtableName = subtable._subtableName;
                        });
                    });
                });
            };

            var getSubtableViewNameFromId = function (id) {
                var subtableViewName = false;

                WS.each(subtableViewNames, function () {
                    if (id.indexOf(this) > -1) {
                        subtableViewName = this;
                    }
                });

                return subtableViewName;
            };

            var isSubtableElement = function (element) {
                if (element.type === 'radio') {
                    return element.isSubtableElement;
                }

                var isInSubtableViewNames = getSubtableViewNameFromId(element.id);

                return (
                    isInSubtableViewNames &&
                    (element.classList.contains('jr-dialog-form-table-input') ||
                        element.classList.contains('jr-dialog-form-table-number') ||
                        element.classList.contains('jr-dialog-form-table-select') ||
                        element.classList.contains('stv_radio') ||
                        element.classList.contains('stv_textarea') ||
                        element.classList.contains('stv_textbox') ||
                        element.classList.contains('stv_text') ||
                        element.classList.contains('stv_decimal') ||
                        element.classList.contains('stv_image') ||
                        element.classList.contains('stv_date') ||
                        element.classList.contains('stv_datetime') ||
                        element.classList.contains('stv_file') ||
                        element.classList.contains('stv_button') ||
                        element.classList.contains('stv_checkbox') ||
                        element.classList.contains('stv_list') ||
                        element.classList.contains('stv_sqllist') ||
                        element.classList.contains('stv_sqltextbox') ||
                        element.classList.contains('stv_autocomplete'))
                );
            };

            var normalizeSubtableProperyPath = function (elementId) {
                var subtableName = getSubtableViewNameFromId(elementId);

                if (!subtableName) {
                    return elementId;
                }

                var path = [];
                path[0] = subtableName;
                elementId = elementId.replace(subtableName + '_', '');
                elementId = elementId.replace('display_', '');
                elementId = elementId.replace('_uploaded', '');
                var row = elementId.split('_').pop();
                var column = elementId.replace('_' + row, '');
                path[2] = column;
                path[1] = row;

                return path;
            };

            var addRadioElements = function (elements) {
                var radioElements = {};

                WS.each(WS.get('.jr-radio'), function () {
                    // eslint-disable-next-line no-prototype-builtins
                    if (!radioElements.hasOwnProperty(this.name)) {
                        radioElements[this.name] = {
                            type: 'radio',
                            id: this.name,
                            isSubtableElement: this.classList.contains('stv_radio'),
                            elements: {}
                        };
                    }

                    radioElements[this.name]['elements'][this.value] = this;
                });

                WS.each(radioElements, function (radioName, elementConfig) {
                    elementConfig.id = radioName;
                    elementConfig.type = 'radio';
                    elements.push(elementConfig);
                });
            };

            var bindContainerElements = function () {
                WS.each(WS.get('#pageContainer .section'), function () {
                    var section = this;
                    var sectionContainer = WS.get('#div_' + this.id);
                    var title = this.querySelector('.jr-section-title');
                    var customRender = false;

                    if (appRenderers[this.id]) {
                        customRender = true;
                    }

                    var leaf = {
                        _rendering: false,
                        _type: 'sectionLeaf',
                        _customRender: customRender,
                        render: appRenderers[this.id] || defaultRenderer,
                        name: this.id,
                        isSubtableElement: false,
                        dependencies: appDependencies[this.id] || []
                    };

                    Object.defineProperty(leaf, 'value', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (!title) {
                                return false;
                            }

                            if (title.innerHTML != newValue) {
                                title.innerHTML = newValue;
                                renderLeaf(leaf, 'value');
                            }
                        },
                        get: function () {
                            if (!title) {
                                return '';
                            }
                            return title.innerHTML;
                        }
                    });

                    Object.defineProperty(leaf, 'node', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (section != newValue) {
                                section = newValue;
                                renderLeaf(leaf, 'value');
                            }
                        },
                        get: function () {
                            return section;
                        }
                    });

                    Object.defineProperty(leaf, 'visible', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (newValue == 1 || newValue === 'Y') {
                                sectionContainer.style.display = '';
                            } else {
                                sectionContainer.style.display = 'none';
                            }
                            renderLeaf(leaf, 'visible');
                        },
                        get: function () {
                            return sectionContainer.style.display != 'none';
                        }
                    });

                    Object.defineProperty(model, this.id, {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            console.log(
                                'It is not allowed to overwrite the "' +
                                    this.id +
                                    '" property of the model object. Assuming you tried to set the value - passing your assignment to ' +
                                    this.id +
                                    '.value instead. (You should change your code!)'
                            );
                            leaf.value = newValue;
                        },
                        get: function () {
                            return leaf;
                        }
                    });
                });

                WS.each(WS.get('#pageContainer .row, #pageContainer .col'), function () {
                    if (this.classList.contains('jr-dialog-col-container')) {
                        return;
                    }

                    var element = this;
                    var elementContainer = WS.get('#' + this.id + 'Container');
                    var customRender = false;

                    if (appRenderers[this.id]) {
                        customRender = true;
                    }

                    var leaf = {
                        _rendering: false,
                        _type: element.classList.contains('row') ? 'rowLeaf' : 'colLeaf',
                        _customRender: customRender,
                        render: appRenderers[this.id] || defaultRenderer,
                        name: this.id,
                        isSubtableElement: false,
                        dependencies: appDependencies[this.id] || []
                    };

                    Object.defineProperty(leaf, 'node', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (element != newValue) {
                                element = newValue;
                                renderLeaf(leaf, 'value');
                            }
                        },
                        get: function () {
                            return element;
                        }
                    });

                    Object.defineProperty(leaf, 'visible', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (newValue == 1 || newValue === 'Y') {
                                elementContainer.style.display = '';
                            } else {
                                elementContainer.style.display = 'none';
                            }
                            renderLeaf(leaf, 'visible');
                        },
                        get: function () {
                            return elementContainer.style.display != 'none';
                        }
                    });

                    Object.defineProperty(leaf, 'width', {
                        enumerable: true,
                        configurable: true,
                        set: function (newValue) {
                            if (isNaN(parseInt(newValue))) {
                                return;
                            }
                            newValue = parseInt(newValue);
                            elementContainer.style.width = newValue + 'px';
                            renderLeaf(leaf, 'width');
                        },
                        get: function () {
                            return elementContainer.style.width;
                        }
                    });

                    Object.defineProperty(model, this.id, {
                        enumerable: true,
                        configurable: true,
                        set: function () {
                            console.log(
                                'It is not allowed to overwrite the "' + this.id + '" property of the model object.'
                            );
                        },
                        get: function () {
                            return leaf;
                        }
                    });
                });
            };

            var structureLeafTypes = ['sectionLeaf', 'rowLeaf', 'colLeaf'];
            model.getElements = function (getStructureLeafs) {
                getStructureLeafs = Boolean(getStructureLeafs);

                var elements = {};

                WS.each(model, function (elementName) {
                    if (typeof this === 'function') {
                        return;
                    }

                    if (!this._type) {
                        return;
                    }

                    if (!getStructureLeafs && structureLeafTypes.indexOf(this._type) > -1) {
                        return;
                    }

                    elements[elementName] = this;
                });

                return elements;
            };

            model.snapshot = {
                snapshots: [],
                currentSnapshotId: 0,

                create: function () {
                    var snapshot = {};

                    WS.each(model.getElements(), function (elementName) {
                        if (this._type === 'subtableNode') {
                            snapshot[elementName] = [];

                            WS.each(this.rows(), function () {
                                var tmp = {};

                                WS.each(this, function (columnName) {
                                    if (this._type === 'dateLeaf' && this.value != '') {
                                        tmp[columnName] = this.value.toJSON();
                                    } else {
                                        tmp[columnName] = this.value;
                                    }
                                });

                                snapshot[elementName].push(tmp);
                            });
                            return;
                        }

                        if (this._type === 'dateLeaf' && this.value != '') {
                            snapshot[elementName] = this.value.toJSON();
                        } else {
                            snapshot[elementName] = this.value;
                        }
                    });

                    this.snapshots[this.currentSnapshotId] = snapshot;
                    return this.currentSnapshotId++;
                },

                get: function (snapshotId) {
                    if (this.snapshots[snapshotId]) {
                        return this.snapshots[snapshotId];
                    }
                    return false;
                },

                load: function (snapshotId) {
                    var snapshot = this.get(snapshotId);

                    if (snapshot) {
                        WS.each(snapshot, function (elementName) {
                            if (
                                WS.isArray(this) &&
                                model[elementName] &&
                                model[elementName]['_type'] === 'subtableNode'
                            ) {
                                model[elementName].init(this);
                            }

                            if (model[elementName]) {
                                if (model[elementName]._type === 'dateLeaf' && this != '') {
                                    model[elementName].value = new Date(this);
                                } else {
                                    model[elementName].value = this;
                                }
                            }
                        });
                    }
                },

                diff: function (snapshotId1, snapshotId2) {
                    var diffs = {};

                    var snapshot1 = this.get(snapshotId1);
                    var snapshot2 = this.get(snapshotId2);

                    if (!snapshot1 || !snapshot2) {
                        return false;
                    }

                    var addSubtableDiv = function (tableName, rowId, column, oldValue, newValue) {
                        if (!diffs[tableName]) {
                            diffs[tableName] = [];
                        }

                        if (!diffs[tableName][rowId]) {
                            diffs[tableName][rowId] = {};
                        }

                        diffs[tableName][rowId][column] = {
                            oldValue: '' + oldValue,
                            newValue: '' + newValue
                        };
                    };

                    WS.each(snapshot1, function (elementName) {
                        if (WS.isArray(this) && model[elementName] && model[elementName]['_type'] === 'subtableNode') {
                            var snapShot1Rows = this;
                            var snapShot2Rows = snapshot2[elementName];

                            if (snapShot1Rows.length === snapShot2Rows.length) {
                                var rowId = 0;
                                while (rowId < snapShot1Rows.length) {
                                    var row1 = snapShot1Rows.shift();
                                    var row2 = snapShot2Rows.shift();

                                    WS.each(row1, function (column) {
                                        if (this != row2[column]) {
                                            addSubtableDiv(elementName, rowId, column, this, row2[column]);
                                        }
                                    });
                                }
                            } else {
                                var rows = WS.keys(snapShot1Rows).concat(WS.keys(snapShot2Rows));

                                rows = rows.filter(function (value, index, self) {
                                    return self.indexOf(value) === index;
                                });

                                WS.each(rows, function (rowId) {
                                    if (snapShot1Rows[rowId] && snapShot2Rows[rowId]) {
                                        WS.each(snapShot1Rows[rowId], function (column) {
                                            if (this != snapShot2Rows[rowId][column]) {
                                                addSubtableDiv(
                                                    elementName,
                                                    rowId,
                                                    column,
                                                    this,
                                                    snapShot2Rows[rowId][column]
                                                );
                                            }
                                        });
                                    } else if (snapShot1Rows[rowId] && !snapShot2Rows[rowId]) {
                                        WS.each(snapShot1Rows[rowId], function (column) {
                                            addSubtableDiv(elementName, rowId, column, this, '');
                                        });
                                    } else if (!snapShot1Rows[rowId] && snapShot2Rows[rowId]) {
                                        WS.each(snapShot2Rows[rowId], function (column) {
                                            addSubtableDiv(elementName, rowId, column, '', this);
                                        });
                                    }
                                });
                            }
                            return;
                        }

                        if (this != snapshot2[elementName]) {
                            // "" + : force primitive data type.
                            diffs[elementName] = {
                                oldValue: '' + this,
                                newValue: '' + snapshot2[elementName]
                            };
                        }
                    });

                    return diffs;
                }
            };

            var removeFormControlElements = function (element) {
                return (
                    !element.parentNode.classList.contains('subtable_rowinfo') &&
                    !element.parentNode.classList.contains('jr-dialog-form-table-header') &&
                    !element.parentNode.classList.contains('jr-dialog-form-table-footer') &&
                    !element.classList.contains('jr-file-wrapper-file-show') &&
                    !element.classList.contains('jr-file-wrapper-file-remove') &&
                    !element.classList.contains('jr-file-upload') &&
                    element.tagName !== 'TD'
                );
            };

            var elements = WS.get(
                '#pageContainer .jr-dialog-form-control, #pageContainer .jr-dialog-form-element-text .text, #pageContainer .jr-checkbox,' +
                    ' #pageContainer .jr-btn, #pageContainer div.sqlTable, #pageContainer .jr-dialog-form-element-description, #pageContainer .jr-dialog-form-table-text'
            ).filter(removeFormControlElements);

            addRadioElements(elements);
            bindElements(elements);
            bindContainerElements();
            addSubtableFunctions();

            WS.each(model.getElements(true), function () {
                if (this._type === 'subtableNode') {
                    WS.each(this.rows(), function () {
                        WS.each(this, function () {
                            if (this._customRender || (this.dependencies && this.dependencies.length > 0)) {
                                renderLeaf(this, 'load');
                            }
                        });
                    });
                    return;
                }

                if (this._customRender || (this.dependencies && this.dependencies.length > 0)) {
                    renderLeaf(this, 'load');
                }
            });

            return model;
        }
    };
})();
