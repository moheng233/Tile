// --------------------------------------------------
// TILE - A 2D JAVASCRIPT TILE ENGINE
// --------------------------------------------------

// --------------------------------------------------
// LICENSE

/*
	Tile is a 2D JavaScript tile engine for the HTML5 canvas
	Copyright (C) 2015 Aaron John Schlosser

	Tile is free software; you can redistribute it and/or
	modify it under the terms of the GNU General Public License
	as published by the Free Software Foundation; either version 2
	of the License, or (at your option) any later version.

	Tile is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program; if not, write to the Free Software
	Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

// END LICENSE
// --------------------------------------------------

// --------------------------------------------------
// ENGINE

var Tile = {};

Tile.Engine = {
	create: function(params) {

		// INITIALIZE PRIVATE VARIABLES

		// Canvas
		var id = params.id || 'container',
			container = document.getElementById(id) || document.createElement('div'),
			canvas = document.createElement('canvas'),
			buffer = document.createElement('canvas'),
			context = canvas.getContext('2d'),
			buffer_ctx = buffer.getContext('2d');
		canvas.width = buffer.width = params.w || params.width || 0;
		canvas.height = buffer.height = params.h || params.height || 0;
		canvas.addEventListener('contextmenu', function(evt){
			evt.preventDefault();
		});
		context.imageSmoothingEnabled = buffer_ctx.imageSmoothingEnabled = false;
		if (!container.id || container.id === '') {
			container.id = id;
			document.getElementsByTagName('body')[0].appendChild(container);
		}
		container.appendChild(canvas);
		buffer.id = 'buffer';
		container.appendChild(buffer);

		// Engine
		var options = params.options || {},
			tilesize = params.tilesize || 16,
			ui = {},
			view = {
				width: Math.floor(canvas.width / tilesize),
				height: Math.floor(canvas.height / tilesize)
			},
			camera = {
				x: Math.floor(canvas.width / tilesize / 2),
				y: Math.floor(canvas.height / tilesize / 2),
			},
			templates = {
				request: new XMLHttpRequest(),
				load: function(template, callback) {
					this.request.callback = callback;
					this.arguments = Array.prototype.slice.call(arguments, 2);
					this.request.onload = function() {
						this.callback.apply(this, this.arguments);
					};
					this.request.open('GET', template);
					this.request.send();
					return this.request.responseXML;
				}
			},
			scopes = {},
			sprites = {},
			spritemaps = {},
			clicks = [],
			utils = params.utils || {},
			states = params.states || [],
			events = options.events || { 
				click: [],
				mousemove: []
			},
			actions = { '*': {} },
			fps = params.fps || 60,
			world = Tile.World.create({
				width : params.world.width || view.width,
				height : params.world.height || view.height,
				types : params.types || { '*': {} }
			});

		// UI
		$.each($.keys(params.ui), function(uid){
			var e = document.createElement('div'),
				buttons = params.ui[uid].buttons ? $.keys(params.ui[uid].buttons) : null,
				template = params.ui[uid].template,
				controller = params.ui[uid].controller,
				content;
			e.id = uid;
			if (template) {
				templates.load(template, function(){
					content = document.createElement('div');
					content.innerHTML = this.responseText;
					scopes[uid] = {};
					controller(scopes[uid]);
					var clicks = content.querySelectorAll('[tile-click]');
					for (var i = 0; i < clicks.length; i++) {
						clicks[i].addEventListener('click', scopes[uid][clicks[i].getAttribute('tile-click')].bind(scopes[uid], clicks[i]));
					}
					e.appendChild(content);
				});
			} else {
				var title = document.createElement('h1');
				title.className = 'title ' + uid;
				title.innerText = params.ui[uid].title || null;
				e.appendChild(title);
				content = document.createElement('p');
				content.className = 'content ' + uid;
				content.innerHTML = params.ui[uid].content || null;
				e.appendChild(content);
			}
			e.style.display = params.ui[uid].display || 'none';
			if (buttons) {
				buttons.forEach(function(button){
					var b = document.createElement('button'),
						props = params.ui[uid].buttons[button];
					b.className = 'button ' + uid + ' ' + button;
					if (props.text) {
						b.innerText = props.text;
					}
					b.addEventListener(props.event, function(){
						if (props.callback) {
							props.action(e, props.callback);	
						} else {
							props.action(e);
						}
					});
					e.appendChild(b);
				});
			}
			container.appendChild(e);
			params.ui[uid].id = e;
			$.extend(params.ui[uid], {
				title: function(s) {
					title.innerText = s || '';
				},
				content: function(s) {
					content.innerHTML = s || '';
				},
				show: function(s) {
					if (s) {
						e.style.display = s;
					} else {
						e.style.display = 'block';
					}
				},
				hide: function() {
					e.style.display = 'none';
				}
			});
			ui[uid] = params.ui[uid];
		});

		// SPRITES
		$.each(params.sprites, function(sprite){
			sprites[sprite.type] = Tile.Sprite.create(sprite);
			spritemaps[sprite.type] = [];
			for (var i = 0; i < 9; i++) {
				spritemaps[sprite.type].push({
					x: i * tilesize,
					y: ($.keys(sprites).length - 1) * tilesize
				});
			}
		});

		// ACTIONS
		$.each(params.actions, function(a){
			var name = a.name || Object.getOwnPropertyNames(actions).length + 1,
				action = a.action,
				types = [],
				events = a.events || [],
				states = a.states || [];
			$.each($.keys(params.types), function(type){
				if (params.types[type].actions && params.types[type].actions.indexOf(name) !== -1) {
					types.push(type);
				}
			});
			if (!name) {
				throw new Error('Actions require a name');
			} else if (typeof action !== 'function') {
				throw new Error('The ' + name + ' action needs to be a function');
			}
			$.each(types, function(type){
				if (!actions[type]) {
					actions[type] = {};
				}
				actions[type][name] = {
					run: action,
					types: function() {
						return types;
					},
					events: function() {
						return events;
					},
					states: function() {
						return states;
					}
				};
			});
		});

		// EVENTS
		$.each(Object.getOwnPropertyNames(events), function(evt) {
			canvas.addEventListener(evt, function(e){
				var ready = true;
				if (options.dblclick) {
					ready = false;
					var timer = setTimeout(function(){
							ready = true;
						}, 200);
					if (e.type === 'dblclick') {
						events.click = [];
						ready = true;
					}
				}
				var x = Math.floor(e.offsetX / tilesize),
					y = Math.floor(e.offsetY / tilesize),
					w = Math.floor(view.width/2),
					h = Math.floor(view.height/2),
					offset;
				if (x <= camera.x && y <= camera.y) {
					offset = {
						x: (camera.x - (w - x)),
						y: (camera.y - (h - y))
					};
				}
				if (x <= camera.x && y >= camera.y) {
					offset = {
						x: (camera.x - (w - x)),
						y: (camera.y + (y - h))
					};
				}
				if (x >= camera.x && y >= camera.y) {
					offset = {
						x: (camera.x + (x - w)),
						y: (camera.y + (y - h))
					};
				}
				if (x >= camera.x && y <= camera.y) {
					offset = {
						x: (camera.x + (x - w)),
						y: (camera.y - (h - y))
					};
				}
				events[evt].push({
					x : offset.x,
					y : offset.y,
					buttons : {
						alt : e.altKey,
						shift : e.shiftKey,
						ctrl : e.ctrlKey,
						button : e.button
					},
					ready : function() {
						return ready;
					}
				});
				e.preventDefault();
			});         
		});

		// PUBLIC INTERFACE
		return {
			utils: function() {
				return utils;
			},
			width: function() {
				return canvas.width;
			},
			height: function() {
				return canvas.width;
			},
			ctx: function() {
				return context;
			},
			sprite: function(sprite) {
				sprites[sprite.type()] = sprite;
			},
			tilesize: function(n, autosize) {
				this.clear();
				if (Number.isInteger(n)) {
					tilesize = n;
					if (autosize) {
						if (!this.maxWidth) {
							this.maxWidth = canvas.width;
							this.maxHeight = canvas.height;
						}
						var newWidth = Math.floor(world.width() * tilesize / 2) + tilesize,
							newHeight = Math.floor(world.height() * tilesize / 2) + tilesize;
						canvas.width = newWidth < this.maxWidth ? newWidth : this.maxWidth;
						canvas.height = newHeight < this.maxHeight ? newHeight : this.maxHeight;
					}
					view = {
						width: Math.floor(canvas.width / tilesize),
						height: Math.floor(canvas.height / tilesize)
					};
					camera = {
						x: Math.floor(canvas.width / tilesize / 2),
						y: Math.floor(canvas.height / tilesize / 2),
					};
				} else {
					return tilesize;
				}
			},
			init: function(callback) {
				if (options.debug) {
					window.game = this;
				}
				var types = Object.getOwnPropertyNames(sprites),
					async = {},
					sync = {};
				if (params.init) {
					$.each($.keys(params.init), function(k){
						if ($.getParams(params.init[k]).length) {
							async[k] = params.init[k];
						} else {
							sync[k] = params.init[k];
						}
					});
				}
				$.extend(async,
					{
						init_generate: function(done) {
							world.generate(function(){
								console.log('done generating');
								done();
							});
						},
						init_sprites: function(done) {
							$.each(types, function(type, next){
								sprites[type].loaded(function(){
									spritemaps[type].forEach(function(map, i){
										var alpha = '0.' + i;
										if (options.draw === true) {
											var buf = document.createElement('canvas');
											buf.width = tilesize;
											buf.height = tilesize;
											buf_ctx = buf.getContext('2d');
											buf_ctx.imageSmoothingEnabled = false;
											buf_ctx.drawImage(sprites[type].img(), 0, 0, tilesize, tilesize);
											buf_ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
											buf_ctx.fillRect(0, 0, tilesize, tilesize);
											map.img = new Image(tilesize,tilesize);
											map.img.src = buf.toDataURL();
										} else {
											buffer_ctx.drawImage(sprites[type].img(), map.x, map.y, tilesize, tilesize);
											buffer_ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
											buffer_ctx.fillRect(map.x,map.y,tilesize,tilesize);
											map.img = buffer_ctx.getImageData(map.x,map.y,tilesize,tilesize);
										}
									});
									next();
								});
							}, function() {
								done();
							});
						}
					}
				);
				$.parallel(async, function(){
					$.each($.keys(sync), function(k, next){
						sync[k]();
						next();
					}, function(){
						callback();
					});
				});
			},
			draw: function(obj) {
				var sprite = sprites[obj.type()],
					depth = obj.depth();
				if (sprite) {
					var x = obj.x(),
						y = obj.y(),
						w = Math.floor(view.width/2),
						h = Math.floor(view.height/2),
						offset;
					if (x <= camera.x && y <= camera.y) {
						offset = {
							x: (w - (camera.x - x)),
							y: (h - (camera.y - y))
						};
					}
					if (x <= camera.x && y >= camera.y) {
						offset = {
							x: (w - (camera.x - x)),
							y: (h + (y - camera.y))
						};
					}
					if (x >= camera.x && y >= camera.y) {
						offset = {
							x: (w + (x - camera.x)),
							y: (h + (y - camera.y))
						};
					}
					if (x >= camera.x && y <= camera.y) {
						offset = {
							x: (w + (x - camera.x)),
							y: (h - (camera.y - y))
						};
					}
					if (options.draw === true) {
						context.drawImage(spritemaps[obj.type()][obj.depth()].img, offset.x*tilesize, offset.y*tilesize, tilesize, tilesize);
					} else {
						context.putImageData(spritemaps[obj.type()][obj.depth()].img, offset.x*tilesize, offset.y*tilesize);
					}
					if (options.draw === true && obj.properties().levels) {
						var levels = $.keys(obj.properties().levels);
						levels.forEach(function(level){
							var alpha = obj.properties().levels[level];
							if (alpha > 6) {
								alpha = 6;
							}
							context.save();
							context.globalAlpha = '0.' + alpha;
							if (options.draw === true) {
								context.drawImage(spritemaps[level][0].img, offset.x*tilesize, offset.y*tilesize, tilesize, tilesize);
							}
							context.restore();
						});
					}
				} else {
					throw new Error('No sprite found for "' + obj.type()) + '" at (' + obj.x() + ',' +obj.y() + ')';
				}
			},
			style: function(css) {
				if (typeof css === 'object') {
					var props = Object.getOwnPropertyNames(css);
					$.each(props, function(prop) {
						prop = prop.split('-');
						var camelCase = prop[0];
						var l = prop.length;
						for (var i = 1; i < l; i++) {
							camelCase += prop[i].charAt(0).toUpperCase() + prop[i].slice(1);
						}
						canvas.style[camelCase] = css[prop];
					});
				}
			},
			spritemap: function(type) {
				return spritemaps[type];
			},
			actions: function() {
				return actions;
			},
			events: function() {
				return events;
			},
			state: function() {
				return {
					list: function() {
						return states;
					},
					has: function(state) {
						if (states.indexOf(state) !== -1) {
							return true;
						}
						return false;
					},
					add: function(state) {
						states.push(state);
					},
					remove: function(state) {
						var i = states.indexOf(state);
						if (i !== -1) {
							states.splice(i,1);
						}
					},
					toggle: function(state) {
						if (this.has(state)) {
							this.remove(state);
							return 0;
						} else {
							this.add(state);
							return 1;
						}
					}
				};
			},
			world: function() {
				return world;
			},
			camera: function(params) {
				if (params) {
					var x = params.x,
						y = params.y,
						w = world.width(),
						h = world.height(),
						v = {
							width: Math.floor(view.width/2),
							height: Math.floor(view.height/2)
						};
					if (x + v.width > w) {
						x = w - v.width;
					}
					if (x - v.width < 0) {
						x = v.width;
					}
					if (y + v.height > h) {
						y = h - v.height -1;
					}
					if (y - v.height < 0) {
						y = v.height;
					}
					camera.x = x;
					camera.y = y;
				} else {
					return camera;
				}
			},
			view: function() {
				return view;
			},
			clear: function() {
				context.clearRect(0, 0, canvas.width, canvas.height);
			},
			render: function(world, z) {
				var self = this,
					obj;

				// Run a particular action given particular conditions
				function run(action) {
					if (action.events().length) {
						$.each(action.events(), function(event){
							var type,
								buttons;
							if (typeof event === 'object') {
								type = event.type;
								buttons = event.buttons;
							} else {
								type = event;
							}
							if (events[type] && events[type].length) {
								for (var i = 0; i < events[type].length; i++) {
									var e = events[type][i];
									if (e.x === x && e.y === y) {
										if (e.ready() && ((event.buttons && $.contains(e.buttons, buttons)) || !event.buttons)) {
											events[type].splice(i, 1);
											if (action.states().length) {
												var valid = false;
												for (var j = 0; j < action.states().length; j++) {
													valid = (states.indexOf(action.states()[j]) !== -1);
												}
												if (valid) {
													action.run(obj);
												}
											} else {
												action.run(obj);
											}
										}
									}
								}
							}
						});
					} else {
						action.run(obj);
					}
				}

				// Process a tile's potential actions
				function process(name) {
					var type = actions[obj.type()],
						any = actions['*'][name];
					if (type && type[name] && (obj.visible() || type[name].always())) {
						run(type[name]);
					} else if (any && (obj.visible() || type[name].always())) {
						run(any);
					}
				}

				// Render tiles in view
				z = z || 0;
				var rows = world.tiles(z);
				for (var x = Math.floor(camera.x - view.width/2); x <= Math.floor(camera.x + view.width/2); x++) {
					for (var y = Math.floor(camera.y - view.height/2); y <= Math.floor(camera.y + view.height/2); y++) {
						if (rows[x] && rows[x][y]) {
							obj = rows[x][y];
							if (obj) {
								if (obj.visible()) {
									self.draw(obj);
								}
								var todo = $.keys(actions[obj.type()] || {}).concat($.keys(actions['*'] || {}));
								$.each(todo, process);
							}
						}
					}
				}

				// Render all persistent tiles
				var persistents = world.tiles('persistent');
				persistents.forEach(function(p){
					obj = world.tiles(z)[p[0]][p[1]];
					if (obj.properties().persistent) {
						var todo = $.keys(actions[obj.type()] || {}).concat($.keys(actions['*'] || {}));
						$.each(todo, process);
					}
				});

				// Run all player actions
				if (actions.player) {
					$.each($.keys(actions.player), function(name){
						actions.player[name].run();
					});
				}

			},
			run: function() {
				var self = this;
				self.init(function(){
					function sequence() {
						self.render(world);
						window.requestAnimationFrame(sequence);
					}
					var running = window.requestAnimationFrame(sequence);
				});
			}
		};
	}
};

// END ENGINE
// --------------------------------------------------
